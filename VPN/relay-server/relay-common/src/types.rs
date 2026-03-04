use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A relay server as stored in Supabase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayServer {
    pub id: Uuid,
    pub hostname: String,
    pub region: String,
    pub city: String,
    pub country_code: String,
    pub public_ip: String,
    pub wireguard_port: u16,
    pub mesh_port: u16,
    pub quic_port: u16,
    pub api_port: u16,
    pub public_key: String,
    pub latitude: f64,
    pub longitude: f64,
    pub max_clients: i32,
    pub current_clients: i32,
    pub status: ServerStatus,
    pub last_heartbeat: DateTime<Utc>,
    pub version: Option<String>,
    pub capabilities: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Registration payload sent to Supabase on startup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerRegistration {
    pub hostname: String,
    pub region: String,
    pub city: String,
    pub country_code: String,
    pub public_ip: String,
    pub wireguard_port: u16,
    pub mesh_port: u16,
    pub quic_port: u16,
    pub api_port: u16,
    pub public_key: String,
    pub latitude: f64,
    pub longitude: f64,
    pub max_clients: i32,
    pub status: ServerStatus,
    pub version: String,
    pub capabilities: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    Initializing,
    Online,
    Degraded,
    Offline,
    Draining,
}

/// Heartbeat payload sent every 15 seconds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heartbeat {
    pub status: ServerStatus,
    pub current_clients: i32,
    pub last_heartbeat: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Latency metric between two relay servers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayMetric {
    pub source_id: Uuid,
    pub target_id: Uuid,
    pub rtt_ms: f64,
    pub jitter_ms: Option<f64>,
    pub packet_loss: f64,
}

/// Latency metric as stored in relay_metrics_latest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayMetricLatest {
    pub source_id: Uuid,
    pub target_id: Uuid,
    pub rtt_ms: f64,
    pub jitter_ms: Option<f64>,
    pub packet_loss: f64,
    pub updated_at: DateTime<Utc>,
}

/// A computed relay path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayPath {
    pub entry_server_id: Uuid,
    pub exit_server_id: Uuid,
    pub path: Vec<Uuid>,
    pub total_rtt_ms: f64,
    pub hop_count: i32,
    pub computed_at: DateTime<Utc>,
}

/// An active user VPN session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub entry_server_id: Uuid,
    pub exit_server_id: Uuid,
    pub relay_path: Vec<Uuid>,
    pub client_public_key: String,
    pub assigned_ip: String,
    pub status: SessionStatus,
    pub connected_at: DateTime<Utc>,
    pub last_handshake: Option<DateTime<Utc>>,
    pub disconnected_at: Option<DateTime<Utc>>,
    pub bytes_tx: i64,
    pub bytes_rx: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Reconnecting,
    Terminated,
}

/// WireGuard client configuration returned to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    pub interface_private_key: String,
    pub interface_address: String,
    pub interface_dns: String,
    pub peer_public_key: String,
    pub peer_endpoint: String,
    pub peer_allowed_ips: String,
}

/// Result from the compute_optimal_path RPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputedPath {
    pub path: Vec<Uuid>,
    pub total_rtt_ms: f64,
    pub hop_count: i32,
}

/// Mesh peer info derived from relay_servers for tunnel setup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshPeer {
    pub server_id: Uuid,
    pub hostname: String,
    pub public_ip: String,
    pub mesh_port: u16,
    pub public_key: String,
    pub mesh_ip: String,
}
