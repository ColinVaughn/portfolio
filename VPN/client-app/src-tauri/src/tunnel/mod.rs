pub mod boringtun_tunnel;
#[cfg(not(mobile))]
pub mod platform;
#[cfg(mobile)]
pub mod platform_mobile;

use crate::errors::AppError;
use crate::state::ConnectionStats;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::{watch, RwLock};
use uuid::Uuid;
use std::io;

#[allow(dead_code)]
pub mod bonding;

pub enum TransportLayer {
    Raw(UdpSocket),
    Bonded(Arc<bonding::BondingLayer>),
}

impl TransportLayer {
    pub async fn send(&self, buf: &[u8]) -> io::Result<usize> {
        match self {
            Self::Raw(socket) => socket.send(buf).await,
            Self::Bonded(layer) => layer.send(buf).await,
        }
    }

    pub async fn recv(&self, buf: &mut [u8]) -> io::Result<usize> {
        match self {
            Self::Raw(socket) => socket.recv(buf).await,
            Self::Bonded(layer) => layer.recv(buf).await,
        }
    }
}

pub struct TunnelManager {
    /// Sender to signal tunnel shutdown
    shutdown_tx: Option<watch::Sender<bool>>,
    /// Running stats
    stats: Arc<RwLock<ConnectionStats>>,
    /// Whether we're currently connected
    connected: bool,
    /// Arc to the channel manager if bonding is active
    pub bonding_channels: Option<Arc<tokio::sync::RwLock<bonding::channel_manager::ChannelManager>>>,
    /// Arc to the live bonding layer for mode switching
    pub bonding_layer: Option<Arc<bonding::BondingLayer>>,
    /// Server endpoint IP for route cleanup on disconnect
    #[allow(dead_code)]
    server_ip: Option<std::net::Ipv4Addr>,
}

impl TunnelManager {
    pub fn new() -> Self {
        Self {
            shutdown_tx: None,
            stats: Arc::new(RwLock::new(ConnectionStats {
                bytes_tx: 0,
                bytes_rx: 0,
                duration_secs: 0,
                connected_since: None,
            })),
            connected: false,
            bonding_channels: None,
            bonding_layer: None,
            server_ip: None,
        }
    }

    pub fn is_connected(&self) -> bool {
        self.connected
    }

    pub async fn get_stats(&self) -> ConnectionStats {
        let stats = self.stats.read().await;
        let mut s = stats.clone();
        if let Some(since) = s.connected_since {
            s.duration_secs = (chrono::Utc::now() - since).num_seconds().max(0) as u64;
        }
        s
    }

    /// Start the WireGuard tunnel (desktop only  - mobile uses native VPN APIs).
    ///
    /// 1. Create a TUN device
    /// 2. Initialize boringtun with client private key + server public key
    /// 3. Bind a UDP socket to the server endpoint
    /// 4. Spawn send/recv loops
    /// 5. Configure DNS and routing
    #[cfg(not(mobile))]
    pub async fn connect(
        &mut self,
        client_private_key: &[u8; 32],
        server_public_key: &[u8; 32],
        endpoint: SocketAddr,
        assigned_ip: std::net::Ipv4Addr,
        dns_servers: &[String],
        session_id: Uuid,
        bonding_mode_pref: Option<String>,
        bonding_session_token: Option<String>,
        bonding_port_hint: Option<u16>,
    ) -> Result<(), AppError> {
        if self.connected {
            return Err(AppError::AlreadyConnected);
        }

        tracing::info!(%endpoint, %assigned_ip, "Starting WireGuard tunnel");

        // Determine MTU based on bonding mode
        let mtu = if bonding_mode_pref.is_some() && bonding_mode_pref.as_deref() != Some("None") {
            1404 // Account for 16-byte bonding header
        } else {
            1420 // WireGuard standard MTU
        };

        // Create TUN device
        let tun_device = platform::create_tun_device(assigned_ip, mtu)
            .map_err(|e| AppError::Tunnel(format!("Failed to create TUN device: {e}")))?;

        // Bind UDP socket for WireGuard traffic
        let udp_socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| AppError::Tunnel(format!("Failed to bind UDP socket: {e}")))?;
        udp_socket
            .connect(endpoint)
            .await
            .map_err(|e| AppError::Tunnel(format!("Failed to connect UDP socket: {e}")))?;

        let transport = if let Some(mode_str) = bonding_mode_pref {
            let mode = match mode_str.as_str() {
                "Speed" => relay_common::bonding::BondingMode::Speed,
                "Redundant" => relay_common::bonding::BondingMode::Redundant,
                "Quality" => relay_common::bonding::BondingMode::Quality,
                _ => return Err(AppError::Tunnel("Invalid bonding mode".into())),
            };

            let mut token = [0u8; 16];
            if let Some(t_str) = bonding_session_token {
                if let Ok(u) = uuid::Uuid::parse_str(&t_str) {
                    token.copy_from_slice(u.as_bytes());
                } else {
                    token.copy_from_slice(session_id.as_bytes());
                }
            } else {
                token.copy_from_slice(session_id.as_bytes());
            }

            // The bonding aggregator runs on a DIFFERENT port than WireGuard.
            // Read it from the server config response, fallback to 51830.
            let bonding_port = bonding_port_hint.unwrap_or(51830);
            let bonding_endpoint = SocketAddr::new(endpoint.ip(), bonding_port);
            tracing::info!(%bonding_endpoint, "Bonding: connecting to aggregator");

            let layer = Arc::new(bonding::BondingLayer::new(token, bonding_endpoint, mode).await);
            self.bonding_channels = Some(layer.channel_manager.clone());
            self.bonding_layer = Some(layer.clone());
            TransportLayer::Bonded(layer)
        } else {
            self.bonding_channels = None;
            self.bonding_layer = None;
            TransportLayer::Raw(udp_socket)
        };

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        // Reset stats
        {
            let mut stats = self.stats.write().await;
            stats.bytes_tx = 0;
            stats.bytes_rx = 0;
            stats.duration_secs = 0;
            stats.connected_since = Some(chrono::Utc::now());
        }

        // Spawn the boringtun packet processing loop
        let stats = self.stats.clone();
        tokio::spawn(boringtun_tunnel::run_tunnel(
            tun_device,
            transport,
            client_private_key.to_owned(),
            server_public_key.to_owned(),
            shutdown_rx,
            stats,
            None, // Desktop uses MITM proxy for adblocking, not DNS filtering
        ));

        // Configure DNS (platform-specific)
        if let Err(e) = platform::set_dns(dns_servers).await {
            tracing::warn!(error = %e, "Failed to set DNS servers");
        }

        // Configure routes to send all traffic through the tunnel
        let server_ip_v4 = match endpoint.ip() {
            std::net::IpAddr::V4(ip) => ip,
            std::net::IpAddr::V6(_) => std::net::Ipv4Addr::UNSPECIFIED,
        };
        self.server_ip = Some(server_ip_v4);
        if let Err(e) = platform::set_routes(server_ip_v4, assigned_ip).await {
            tracing::warn!(error = %e, "Failed to set VPN routes");
        }

        self.shutdown_tx = Some(shutdown_tx);
        self.connected = true;

        tracing::info!("WireGuard tunnel established");
        Ok(())
    }

    /// Mobile connect  - receives a TUN file descriptor from the native VPN
    /// service (obtained by the commands layer via the Tauri VPN plugin),
    /// then runs boringtun over it.
    #[cfg(mobile)]
    pub async fn connect(
        &mut self,
        client_private_key: &[u8; 32],
        server_public_key: &[u8; 32],
        endpoint: SocketAddr,
        assigned_ip: std::net::Ipv4Addr,
        _dns_servers: &[String],
        _session_id: Uuid,
        _bonding_mode_pref: Option<String>,
        _bonding_session_token: Option<String>,
        _bonding_port_hint: Option<u16>,
        tun_fd: i64,
        dns_filter: Option<Arc<crate::dns_filter::DnsFilter>>,
    ) -> Result<(), AppError> {
        if self.connected {
            return Err(AppError::AlreadyConnected);
        }

        tracing::info!(%endpoint, %assigned_ip, tun_fd, "Starting mobile WireGuard tunnel");

        // NOTE: Channel bonding is not supported on mobile.

        // Wrap the TUN file descriptor from the native VPN service
        let tun_device = platform_mobile::MobileTunDevice::from_fd(tun_fd)
            .map_err(|e| AppError::Tunnel(format!("Failed to create TUN device from fd: {e}")))?;

        // Bind UDP socket for WireGuard traffic
        let udp_socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| AppError::Tunnel(format!("Failed to bind UDP socket: {e}")))?;
        udp_socket
            .connect(endpoint)
            .await
            .map_err(|e| AppError::Tunnel(format!("Failed to connect UDP socket: {e}")))?;

        let transport = TransportLayer::Raw(udp_socket);

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        // Reset stats
        {
            let mut stats = self.stats.write().await;
            stats.bytes_tx = 0;
            stats.bytes_rx = 0;
            stats.duration_secs = 0;
            stats.connected_since = Some(chrono::Utc::now());
        }

        // Spawn the boringtun packet processing loop with DNS filtering
        let stats = self.stats.clone();
        tokio::spawn(boringtun_tunnel::run_tunnel(
            tun_device,
            transport,
            client_private_key.to_owned(),
            server_public_key.to_owned(),
            shutdown_rx,
            stats,
            dns_filter,
        ));

        self.shutdown_tx = Some(shutdown_tx);
        self.connected = true;

        tracing::info!("Mobile WireGuard tunnel established");
        Ok(())
    }

    /// Disconnect the tunnel and restore network settings.
    pub async fn disconnect(&mut self) -> Result<(), AppError> {
        if !self.connected {
            return Err(AppError::NotConnected);
        }

        tracing::info!("Disconnecting WireGuard tunnel");

        // Signal shutdown to the tunnel loop
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(true);
        }

        // Restore routes (desktop only)
        #[cfg(not(mobile))]
        {
            if let Some(server_ip) = self.server_ip.take() {
                if let Err(e) = platform::restore_routes(server_ip).await {
                    tracing::warn!(error = %e, "Failed to restore routes");
                }
            }

            // Restore DNS
            if let Err(e) = platform::restore_dns().await {
                tracing::warn!(error = %e, "Failed to restore DNS settings");
            }
        }

        self.connected = false;

        tracing::info!("WireGuard tunnel disconnected");
        Ok(())
    }
}

impl Drop for TunnelManager {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(true);
        }
    }
}
