use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

use crate::api::client_config;
use crate::bonding::SessionManager;
use crate::config::RelayConfig;
use crate::health::metrics as prom;
use crate::mesh::discovery::MeshDiscovery;
use crate::routing::forwarding::ForwardingManager;
use crate::supabase::client::SupabaseClient;
use crate::wg::interface::WgInterface;
use crate::wg::keys::WgKeyPair;
use crate::wg::peer::PeerManager;

/// Shared application state
#[derive(Clone)]
#[allow(dead_code)]
pub struct AppState {
    pub server_id: Uuid,
    pub config: RelayConfig,
    pub client_keypair: WgKeyPair,
    pub client_interface: Arc<WgInterface>,
    pub peer_manager: Arc<PeerManager>,
    pub supabase: Arc<SupabaseClient>,
    pub discovery: Arc<MeshDiscovery>,
    pub forwarding: Arc<ForwardingManager>,
    pub bonding_sessions: Arc<SessionManager>,
}

/// Start the local HTTP API server with rate limiting and CORS
pub async fn start_api_server(
    state: Arc<AppState>,
    shutdown: tokio::sync::watch::Receiver<bool>,
) -> anyhow::Result<()> {
    let bind_addr = format!(
        "{}:{}",
        state.config.api.bind_address, state.config.api.port
    );

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/status", get(server_status))
        .route("/sessions", post(create_session))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;

    tracing::info!(address = bind_addr, "API server listening");

    let mut shutdown_rx = shutdown;
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            while !*shutdown_rx.borrow() {
                if shutdown_rx.changed().await.is_err() {
                    break;
                }
            }
        })
        .await?;

    Ok(())
}

/// GET /health - Simple health check
async fn health_check() -> StatusCode {
    StatusCode::OK
}

/// GET /status - Detailed server status
async fn server_status(State(state): State<Arc<AppState>>) -> Json<ServerStatusResponse> {
    let client_count = state.peer_manager.client_count().await;
    let mesh_peers = state.discovery.peer_count().await;
    let forwarding_rules = state.forwarding.active_rules().await.len();

    // Update Prometheus gauges
    prom::set_client_count(client_count);
    prom::set_mesh_peer_count(mesh_peers);
    prom::set_forwarding_rules(forwarding_rules);

    Json(ServerStatusResponse {
        server_id: state.server_id,
        hostname: state.config.server.hostname.clone(),
        region: state.config.server.region.clone(),
        city: state.config.server.city.clone(),
        status: "online".to_string(),
        client_count,
        max_clients: state.config.server.max_clients as usize,
        mesh_peers,
        forwarding_rules,
        version: state.config.server.version.clone(),
        quic_enabled: state.config.quic.enabled,
    })
}

/// POST /sessions - Create a new client VPN session
async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, (StatusCode, String)> {
    // Validate client public key format (base64-encoded 32-byte Curve25519 key)
    if let Err(msg) = validate_wg_public_key(&req.client_public_key) {
        return Err((StatusCode::BAD_REQUEST, msg));
    }

    // Check capacity
    let current = state.peer_manager.client_count().await;
    if current >= state.config.server.max_clients as usize {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "Server at capacity".to_string(),
        ));
    }

    // Use the IP assigned by the edge function's IPAM, or allocate locally as fallback
    let session_id = Uuid::new_v4();
    let assigned_ip = match req
        .assigned_ip
        .as_deref()
        .and_then(|s| s.parse::<std::net::Ipv4Addr>().ok())
    {
        Some(ip) => ip,
        None => {
            state
                .peer_manager
                .allocate_ip(&req.client_public_key, session_id, req.user_id)
                .await
        }
    };

    // Add client as WireGuard peer
    if let Err(e) = state.client_interface.add_peer(
        &req.client_public_key,
        None,
        &[&format!("{}/32", assigned_ip)],
        None,
    ) {
        // Clean up allocated IP on failure
        state.peer_manager.release_ip(&req.client_public_key).await;
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to add WireGuard peer: {e}"),
        ));
    }

    // If we have a relay path, validate and set up forwarding
    if let Some(ref path) = req.relay_path {
        if path.is_empty() {
            // Clean up on validation failure
            let _ = state.client_interface.remove_peer(&req.client_public_key);
            state.peer_manager.release_ip(&req.client_public_key).await;
            return Err((
                StatusCode::BAD_REQUEST,
                "Tunnely path cannot be empty".to_string(),
            ));
        }
        if !path.contains(&state.server_id) {
            let _ = state.client_interface.remove_peer(&req.client_public_key);
            state.peer_manager.release_ip(&req.client_public_key).await;
            return Err((
                StatusCode::BAD_REQUEST,
                "Tunnely path must include this server".to_string(),
            ));
        }
        if let Err(e) = state
            .forwarding
            .setup_session(session_id, &assigned_ip.to_string(), path)
            .await
        {
            // Clean up WG peer and IP on forwarding failure
            let _ = state.client_interface.remove_peer(&req.client_public_key);
            state.peer_manager.release_ip(&req.client_public_key).await;
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to set up forwarding: {e}"),
            ));
        }
    }

    prom::record_client_connected();

    // Generate WireGuard config for the client
    let endpoint = format!(
        "{}:{}",
        state.config.server.public_ip, state.config.wireguard.client_port
    );

    let config = client_config::generate_client_config(
        &state.client_keypair.public_key_base64(),
        &endpoint,
        &req.client_private_key.unwrap_or_default(),
        &assigned_ip,
        &state.config.wireguard.dns_servers,
    );

    let wg_config = client_config::config_to_wg_format(&config);

    // If bonding is enabled and the server supports it
    let mut bonding_port = None;
    let mut bonding_session_token = None;

    if req.bonding_enabled.unwrap_or(false) && state.config.bonding.enabled {
        let token = Uuid::new_v4();
        let mode = match req.bonding_mode.as_deref() {
            Some("Speed") => relay_common::bonding::BondingMode::Speed,
            Some("Redundant") => relay_common::bonding::BondingMode::Redundant,
            Some("Quality") => relay_common::bonding::BondingMode::Quality,
            _ => relay_common::bonding::BondingMode::Speed,
        };

        // Add to SessionManager
        let mut t_bytes = [0u8; 16];
        t_bytes.copy_from_slice(token.as_bytes());
        state.bonding_sessions.add_session(t_bytes, mode).await;

        bonding_port = Some(state.config.bonding.port);
        bonding_session_token = Some(token.to_string());
    }

    Ok(Json(CreateSessionResponse {
        session_id,
        assigned_ip: assigned_ip.to_string(),
        server_public_key: state.client_keypair.public_key_base64(),
        endpoint,
        wg_config,
        bonding_port,
        bonding_session_token,
    }))
}

#[derive(Debug, Serialize)]
struct ServerStatusResponse {
    server_id: Uuid,
    hostname: String,
    region: String,
    city: String,
    status: String,
    client_count: usize,
    max_clients: usize,
    mesh_peers: usize,
    forwarding_rules: usize,
    version: String,
    quic_enabled: bool,
}

#[derive(Debug, Deserialize)]
struct CreateSessionRequest {
    user_id: Uuid,
    client_public_key: String,
    client_private_key: Option<String>,
    assigned_ip: Option<String>,
    relay_path: Option<Vec<Uuid>>,
    bonding_enabled: Option<bool>,
    bonding_mode: Option<String>,
}

#[derive(Debug, Serialize)]
struct CreateSessionResponse {
    session_id: Uuid,
    assigned_ip: String,
    server_public_key: String,
    endpoint: String,
    wg_config: String,
    bonding_port: Option<u16>,
    bonding_session_token: Option<String>,
}

/// Validate a WireGuard public key is properly formatted (base64-encoded 32-byte key)
fn validate_wg_public_key(key: &str) -> Result<(), String> {
    use base64::Engine;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(key)
        .map_err(|_| "Invalid base64 in client_public_key".to_string())?;
    if decoded.len() != 32 {
        return Err(format!(
            "client_public_key must be 32 bytes (got {})",
            decoded.len()
        ));
    }
    Ok(())
}
