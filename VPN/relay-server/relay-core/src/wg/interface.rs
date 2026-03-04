use anyhow::{Context, Result};
use defguard_wireguard_rs::{
    host::Peer, key::Key, net::IpAddrMask, InterfaceConfiguration, WGApi, WireguardInterfaceApi,
};
use std::net::SocketAddr;
use std::str::FromStr;

use super::keys::WgKeyPair;

/// Manages a WireGuard interface lifecycle
pub struct WgInterface {
    api: WGApi,
    name: String,
}

impl WgInterface {
    /// Create a new WireGuard interface
    pub fn create(name: &str, keypair: &WgKeyPair, listen_port: u16, address: &str) -> Result<Self> {
        let api = WGApi::new(name.to_string())
            .map_err(|e| anyhow::anyhow!("Failed to create WG API for {name}: {e}"))?;

        // Create the interface
        api.create_interface()
            .map_err(|e| anyhow::anyhow!("Failed to create interface {name}: {e}"))?;

        // Parse address into IpAddrMask
        let addr_mask = IpAddrMask::from_str(address)
            .map_err(|e| anyhow::anyhow!("Invalid interface address {address}: {e}"))?;

        // Configure the interface
        let config = InterfaceConfiguration {
            name: name.to_string(),
            prvkey: keypair.private_key_base64(),
            addresses: vec![addr_mask],
            port: listen_port as u32,
            peers: vec![],
            mtu: None,
        };

        #[cfg(target_os = "windows")]
        api.configure_interface(&config, &[], &[])
            .map_err(|e| anyhow::anyhow!("Failed to configure interface {name}: {e}"))?;

        #[cfg(not(target_os = "windows"))]
        api.configure_interface(&config)
            .map_err(|e| anyhow::anyhow!("Failed to configure interface {name}: {e}"))?;

        tracing::info!(
            interface = name,
            port = listen_port,
            address = address,
            "WireGuard interface created"
        );

        Ok(Self {
            api,
            name: name.to_string(),
        })
    }

    /// Add a peer to this interface
    pub fn add_peer(
        &self,
        public_key: &str,
        endpoint: Option<&str>,
        allowed_ips: &[&str],
        persistent_keepalive: Option<u16>,
    ) -> Result<()> {
        let key = Key::from_str(public_key)
            .map_err(|e| anyhow::anyhow!("Invalid peer public key: {e}"))?;

        let mut peer = Peer::new(key);

        if let Some(ep) = endpoint {
            peer.endpoint = Some(
                SocketAddr::from_str(ep)
                    .with_context(|| format!("Invalid endpoint address: {ep}"))?,
            );
        }

        for ip in allowed_ips {
            let addr_mask = IpAddrMask::from_str(ip)
                .map_err(|e| anyhow::anyhow!("Invalid allowed IP {ip}: {e}"))?;
            peer.allowed_ips.push(addr_mask);
        }

        if let Some(ka) = persistent_keepalive {
            peer.persistent_keepalive_interval = Some(ka);
        }

        self.api
            .configure_peer(&peer)
            .map_err(|e| anyhow::anyhow!("Failed to add peer: {e}"))?;

        tracing::info!(
            interface = self.name,
            peer_key = &public_key[..8],
            "Peer added"
        );

        Ok(())
    }

    /// Remove a peer from this interface
    pub fn remove_peer(&self, public_key: &str) -> Result<()> {
        let key = Key::from_str(public_key)
            .map_err(|e| anyhow::anyhow!("Invalid peer public key: {e}"))?;

        self.api
            .remove_peer(&key)
            .map_err(|e| anyhow::anyhow!("Failed to remove peer: {e}"))?;

        tracing::info!(
            interface = self.name,
            peer_key = &public_key[..8],
            "Peer removed"
        );

        Ok(())
    }

    /// Get interface name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Read current interface state (peers, stats, etc.)
    pub fn read_interface_data(&self) -> Result<defguard_wireguard_rs::host::Host> {
        self.api
            .read_interface_data()
            .map_err(|e| anyhow::anyhow!("Failed to read interface data for {}: {e}", self.name))
    }
}

impl Drop for WgInterface {
    fn drop(&mut self) {
        if let Err(e) = self.api.remove_interface() {
            tracing::error!(
                interface = self.name,
                error = %e,
                "Failed to remove WireGuard interface on drop"
            );
        } else {
            tracing::info!(interface = self.name, "WireGuard interface removed");
        }
    }
}
