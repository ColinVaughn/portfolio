use metrics::{counter, gauge, histogram};
use metrics_exporter_prometheus::PrometheusBuilder;
use std::net::SocketAddr;

/// Initialize the Prometheus metrics exporter on a separate port
pub fn init_prometheus(bind_addr: &str, port: u16) -> anyhow::Result<()> {
    let addr: SocketAddr = format!("{bind_addr}:{port}").parse()?;

    PrometheusBuilder::new()
        .with_http_listener(addr)
        .install()
        .map_err(|e| anyhow::anyhow!("Failed to install Prometheus exporter: {e}"))?;

    tracing::info!(address = %addr, "Prometheus metrics endpoint ready at /metrics");

    Ok(())
}

/// Record a client connection event
pub fn record_client_connected() {
    counter!("relay_clients_connected_total").increment(1);
}

/// Record a client disconnection event
pub fn record_client_disconnected() {
    counter!("relay_clients_disconnected_total").increment(1);
}

/// Update the current client count gauge
pub fn set_client_count(count: usize) {
    gauge!("relay_clients_current").set(count as f64);
}

/// Record a mesh peer latency probe result
pub fn record_probe_rtt(peer_hostname: &str, rtt_ms: f64) {
    histogram!("relay_mesh_rtt_ms", "peer" => peer_hostname.to_string()).record(rtt_ms);
}

/// Record mesh peer count
pub fn set_mesh_peer_count(count: usize) {
    gauge!("relay_mesh_peers").set(count as f64);
}

/// Record a heartbeat send
pub fn record_heartbeat_sent() {
    counter!("relay_heartbeats_sent_total").increment(1);
}

/// Record heartbeat failure
pub fn record_heartbeat_failed() {
    counter!("relay_heartbeats_failed_total").increment(1);
}

/// Record a QUIC connection event
pub fn record_quic_connection() {
    counter!("relay_quic_connections_total").increment(1);
}

/// Set the server status gauge (1 = online, 0 = offline)
pub fn set_server_online(online: bool) {
    gauge!("relay_server_online").set(if online { 1.0 } else { 0.0 });
}

/// Record forwarding rule count
pub fn set_forwarding_rules(count: usize) {
    gauge!("relay_forwarding_rules_active").set(count as f64);
}
