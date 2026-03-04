use crate::state::ConnectionStats;
use boringtun::noise::{Tunn, TunnResult};
use std::sync::Arc;
use tokio::sync::{watch, RwLock};
use super::TransportLayer;

const MAX_PACKET: usize = 65536;

/// Trait abstracting a TUN device for both desktop and mobile.
///
/// Both `platform::TunDevice` and `platform_mobile::MobileTunDevice`
/// implement this with identical async read/write signatures.
pub trait TunReadWrite: Send + 'static {
    fn read(&mut self, buf: &mut [u8]) -> impl std::future::Future<Output = std::io::Result<usize>> + Send;
    fn write(&mut self, data: &[u8]) -> impl std::future::Future<Output = std::io::Result<()>> + Send;
}

#[cfg(not(mobile))]
impl TunReadWrite for super::platform::TunDevice {
    async fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.read(buf).await
    }
    async fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
        self.write(data).await
    }
}

#[cfg(mobile)]
impl TunReadWrite for super::platform_mobile::MobileTunDevice {
    async fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.read(buf).await
    }
    async fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
        self.write(data).await
    }
}

/// Main tunnel loop: bridges TUN device <-> UDP socket via boringtun.
///
/// Reads packets from the TUN device, encrypts them with boringtun, and sends
/// them via UDP to the WireGuard server. Incoming UDP packets are decrypted
/// and written back to the TUN device.
///
/// Optionally integrates DNS-level ad blocking on mobile: outgoing DNS queries
/// for blocked domains are intercepted and answered with a synthesized response
/// before reaching the WireGuard tunnel.
pub async fn run_tunnel<T: TunReadWrite>(
    mut tun: T,
    transport: TransportLayer,
    client_private_key: [u8; 32],
    server_public_key: [u8; 32],
    mut shutdown_rx: watch::Receiver<bool>,
    stats: Arc<RwLock<ConnectionStats>>,
    dns_filter: Option<Arc<crate::dns_filter::DnsFilter>>,
) {
    // Create boringtun tunnel instance
    let mut tunn = match Tunn::new(
        x25519_dalek::StaticSecret::from(client_private_key),
        x25519_dalek::PublicKey::from(server_public_key),
        None, // preshared key
        None, // keepalive
        0,    // index
        None, // rate limiter
    ) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to create boringtun tunnel: {e}");
            return;
        }
    };

    let mut tun_buf = vec![0u8; MAX_PACKET];
    let mut udp_buf = vec![0u8; MAX_PACKET];
    let mut out_buf = vec![0u8; MAX_PACKET];

    // Send initial handshake
    let handshake_result = tunn.format_handshake_initiation(&mut out_buf, false);
    if let TunnResult::WriteToNetwork(data) = handshake_result {
        if let Err(e) = transport.send(data).await {
            tracing::error!("Failed to send handshake: {e}");
            return;
        }
    }

    // Create timer for WireGuard maintenance ticks
    let mut tick_interval = tokio::time::interval(std::time::Duration::from_millis(250));

    loop {
        tokio::select! {
            // Shutdown signal
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    tracing::info!("Tunnel shutdown signal received");
                    break;
                }
            }

            // Read from TUN device (outgoing traffic)
            tun_result = tun.read(&mut tun_buf) => {
                match tun_result {
                    Ok(n) if n > 0 => {
                        // DNS filtering: intercept blocked DNS queries
                        if let Some(ref filter) = dns_filter {
                            if let Some(response) = filter.process_packet(&tun_buf[..n]).await {
                                // Write synthesized DNS response back to TUN
                                if let Err(e) = tun.write(&response).await {
                                    tracing::warn!("TUN write (DNS block) error: {e}");
                                }
                                continue; // Don't forward to WireGuard
                            }
                        }

                        match tunn.encapsulate(&tun_buf[..n], &mut out_buf) {
                            TunnResult::WriteToNetwork(data) => {
                                if let Err(e) = transport.send(data).await {
                                    tracing::warn!("UDP send error: {e}");
                                }
                                let mut s = stats.write().await;
                                s.bytes_tx += n as u64;
                            }
                            TunnResult::Done => {}
                            TunnResult::Err(e) => {
                                tracing::warn!("Encapsulate error: {e:?}");
                            }
                            _ => {}
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::warn!("TUN read error: {e}");
                    }
                }
            }

            // Read from UDP socket (incoming traffic)
            udp_result = transport.recv(&mut udp_buf) => {
                match udp_result {
                    Ok(n) if n > 0 => {
                        match tunn.decapsulate(None, &udp_buf[..n], &mut out_buf) {
                            TunnResult::WriteToTunnelV4(data, _) | TunnResult::WriteToTunnelV6(data, _) => {
                                if let Err(e) = tun.write(data).await {
                                    tracing::warn!("TUN write error: {e}");
                                }
                                let mut s = stats.write().await;
                                s.bytes_rx += data.len() as u64;
                            }
                            TunnResult::WriteToNetwork(data) => {
                                // Response packet (e.g., handshake response)
                                if let Err(e) = transport.send(data).await {
                                    tracing::warn!("UDP send error: {e}");
                                }
                            }
                            TunnResult::Done => {}
                            TunnResult::Err(e) => {
                                tracing::warn!("Decapsulate error: {e:?}");
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::warn!("UDP recv error: {e}");
                    }
                }
            }

            // Timer tick for WireGuard maintenance (keepalive, handshake retry)
            _ = tick_interval.tick() => {
                match tunn.update_timers(&mut out_buf) {
                    TunnResult::WriteToNetwork(data) => {
                        if let Err(e) = transport.send(data).await {
                            tracing::warn!("Timer UDP send error: {e}");
                        }
                    }
                    TunnResult::Err(e) => {
                        tracing::warn!("Timer error: {e:?}");
                    }
                    _ => {}
                }
            }
        }
    }

    tracing::info!("Tunnel loop exited");
}
