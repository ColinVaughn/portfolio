use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Disconnecting,
    Reconnecting,
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub session_id: Uuid,
    pub assigned_ip: String,
    pub server_public_key: String,
    pub endpoint: String,
    pub entry_server: ServerSummary,
    pub exit_server: ServerSummary,
    pub relay_path: Vec<Uuid>,
    pub dns: Vec<String>,
    pub bonding_enabled: bool,
    pub bonding_session_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerSummary {
    pub id: Uuid,
    pub hostname: String,
    pub city: String,
    pub region: String,
    pub country_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStats {
    pub bytes_tx: u64,
    pub bytes_rx: u64,
    pub duration_secs: u64,
    pub connected_since: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub state: ConnectionState,
    pub info: Option<ConnectionInfo>,
    pub stats: Option<ConnectionStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub price_monthly: f64,
    pub price_yearly: f64,
    pub features: serde_json::Value,
    pub max_devices: i32,
    pub bandwidth_limit_gb: Option<i32>,
    pub can_bond: bool,
    pub server_access: String,
    #[serde(default)]
    pub can_adblock_client: bool,
    #[serde(default)]
    pub can_adblock_cosmetic: bool,
    #[serde(default)]
    pub can_adblock_custom: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: Uuid,
    pub plan: Plan,
    pub status: String,
    pub billing_interval: String,
    pub current_period_end: Option<String>,
    pub cancel_at_period_end: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayServer {
    pub id: Uuid,
    pub hostname: String,
    pub region: String,
    pub city: String,
    pub country_code: String,
    pub public_ip: String,
    pub wireguard_port: i32,
    pub quic_port: i32,
    pub current_clients: i32,
    pub max_clients: i32,
    pub status: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserLocation {
    pub latitude: f64,
    pub longitude: f64,
    pub city: String,
    pub country_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerLatency {
    pub server_id: Uuid,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentConnection {
    pub server_id: Uuid,
    pub city: String,
    pub country_code: String,
    pub connected_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppPreferences {
    pub auto_connect_on_launch: bool,
    pub launch_on_startup: bool,
    pub kill_switch_enabled: bool,
    pub notifications_enabled: bool,
    pub custom_dns: Option<String>,
    pub minimize_to_tray_on_close: bool,
    pub bonding_mode: String,
    pub theme: String,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            auto_connect_on_launch: false,
            launch_on_startup: false,
            kill_switch_enabled: false,
            notifications_enabled: true,
            custom_dns: None,
            minimize_to_tray_on_close: true,
            bonding_mode: "None".to_string(),
            theme: "system".to_string(),
        }
    }
}

pub struct AppState {
    pub connection: ConnectionState,
    pub connection_info: Option<ConnectionInfo>,
    pub connection_stats: Option<ConnectionStats>,
    pub user: Option<UserProfile>,
    pub subscription: Option<Subscription>,
    pub servers: Vec<RelayServer>,
    #[allow(dead_code)]
    pub selected_entry_server: Option<Uuid>,
    #[allow(dead_code)]
    pub selected_exit_server: Option<Uuid>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            connection: ConnectionState::Disconnected,
            connection_info: None,
            connection_stats: None,
            user: None,
            subscription: None,
            servers: Vec::new(),
            selected_entry_server: None,
            selected_exit_server: None,
            access_token: None,
            refresh_token: None,
        }
    }
}

pub type SharedState = Arc<RwLock<AppState>>;

pub fn new_shared_state() -> SharedState {
    Arc::new(RwLock::new(AppState::default()))
}
