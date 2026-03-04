use anyhow::Result;
use uuid::Uuid;

use crate::config::RelayConfig;
use crate::wg::interface::WgInterface;
use crate::wg::keys::WgKeyPair;
use crate::wg::peer::mesh_ip_from_uuid;

/// Create the mesh WireGuard interface for inter-relay tunnels
pub fn create_mesh_interface(
    server_id: &Uuid,
    keypair: &WgKeyPair,
    config: &RelayConfig,
) -> Result<WgInterface> {
    let mesh_ip = mesh_ip_from_uuid(server_id);
    let address = format!("{}/16", mesh_ip);

    tracing::info!(
        interface = "wg-mesh",
        mesh_ip = %mesh_ip,
        port = config.wireguard.mesh_port,
        "Creating mesh WireGuard interface"
    );

    WgInterface::create("wg-mesh", keypair, config.wireguard.mesh_port, &address)
}

/// Create the client-facing WireGuard interface
pub fn create_client_interface(
    keypair: &WgKeyPair,
    config: &RelayConfig,
) -> Result<WgInterface> {
    // Server gets .1 in the client subnet
    let base: std::net::Ipv4Addr = config
        .wireguard
        .client_subnet
        .split('/')
        .next()
        .unwrap_or("10.0.0.0")
        .parse()
        .unwrap_or(std::net::Ipv4Addr::new(10, 0, 0, 0));

    let octets = base.octets();
    let server_ip = std::net::Ipv4Addr::new(octets[0], octets[1], 0, 1);
    let address = format!("{}/16", server_ip);

    tracing::info!(
        interface = "wg-clients",
        address = %address,
        port = config.wireguard.client_port,
        "Creating client WireGuard interface"
    );

    WgInterface::create("wg-clients", keypair, config.wireguard.client_port, &address)
}
