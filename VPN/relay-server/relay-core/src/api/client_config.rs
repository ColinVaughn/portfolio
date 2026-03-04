use relay_common::types::ClientConfig;
use std::net::Ipv4Addr;

/// Generate a WireGuard client configuration
pub fn generate_client_config(
    server_public_key: &str,
    server_endpoint: &str,
    client_private_key: &str,
    assigned_ip: &Ipv4Addr,
    dns_servers: &[String],
) -> ClientConfig {
    ClientConfig {
        interface_private_key: client_private_key.to_string(),
        interface_address: format!("{}/32", assigned_ip),
        interface_dns: dns_servers.join(", "),
        peer_public_key: server_public_key.to_string(),
        peer_endpoint: server_endpoint.to_string(),
        peer_allowed_ips: "0.0.0.0/0, ::/0".to_string(),
    }
}

/// Format config as WireGuard INI format
pub fn config_to_wg_format(config: &ClientConfig) -> String {
    format!(
        "[Interface]\n\
         PrivateKey = {}\n\
         Address = {}\n\
         DNS = {}\n\
         \n\
         [Peer]\n\
         PublicKey = {}\n\
         Endpoint = {}\n\
         AllowedIPs = {}\n\
         PersistentKeepalive = 25\n",
        config.interface_private_key,
        config.interface_address,
        config.interface_dns,
        config.peer_public_key,
        config.peer_endpoint,
        config.peer_allowed_ips,
    )
}
