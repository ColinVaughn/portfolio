use crate::errors::AppError;
use crate::keychain::Keychain;
use crate::latency;
use crate::preferences;
use crate::state::*;
use crate::supabase::SupabaseClient;
use crate::tunnel::TunnelManager;
#[cfg(not(mobile))]
use crate::adblock::AdblockService;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{Emitter, State};
#[cfg(mobile)]
use tauri::Manager;
use tokio::sync::RwLock;
use uuid::Uuid;

pub type SupabaseState = Arc<SupabaseClient>;
pub type TunnelState = Arc<RwLock<TunnelManager>>;
#[cfg(not(mobile))]
pub type AdblockState = Arc<RwLock<AdblockService>>;
#[cfg(mobile)]
pub type MobileAdblockState = Arc<RwLock<crate::adblock_mobile::MobileAdblockService>>;
pub type PkceState = Arc<Mutex<HashMap<String, String>>>; // challenge -> verifier

// ─── Auth Commands ───

#[tauri::command]
pub async fn login(
    email: String,
    password: String,
    supabase: State<'_, SupabaseState>,
    app_state: State<'_, SharedState>,
) -> Result<UserProfile, AppError> {
    let (profile, access_token, refresh_token) = supabase.login(&email, &password).await?;

    // Store tokens in OS keychain (or file on Android)
    Keychain::store_auth_token(&access_token, &refresh_token)?;

    // Fetch subscription
    let sub = supabase
        .fetch_subscription(&access_token, &profile.id)
        .await
        .ok();

    // Update app state (including tokens for mobile fallback)
    {
        let mut state = app_state.write().await;
        state.user = Some(profile.clone());
        state.subscription = sub;
        state.access_token = Some(access_token);
        state.refresh_token = Some(refresh_token);
    }

    Ok(profile)
}

#[tauri::command]
pub async fn signup(
    email: String,
    password: String,
    supabase: State<'_, SupabaseState>,
    app_state: State<'_, SharedState>,
) -> Result<UserProfile, AppError> {
    let (profile, access_token, refresh_token) = supabase.signup(&email, &password).await?;

    Keychain::store_auth_token(&access_token, &refresh_token)?;

    {
        let mut state = app_state.write().await;
        state.user = Some(profile.clone());
        state.access_token = Some(access_token);
        state.refresh_token = Some(refresh_token);
    }

    Ok(profile)
}

#[tauri::command]
pub async fn start_oauth_flow(
    provider: String,
    supabase: State<'_, SupabaseState>,
    pkce_state: State<'_, PkceState>,
) -> Result<(), AppError> {
    let (url, challenge, verifier) = supabase.generate_pkce_oauth_url(&provider)?;
    
    // Store the verifier temporarily in memory tied to this challenge
    let mut state = pkce_state.lock().await;
    state.insert(challenge.clone(), verifier.clone());
    
    // Open the system browser
    if let Err(e) = open::that(&url) {
        tracing::error!("Failed to open system browser: {}", e);
        return Err(AppError::Other("Failed to open default web browser".into()));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn finish_oauth_flow(
    auth_code: String,
    supabase: State<'_, SupabaseState>,
    app_state: State<'_, SharedState>,
    pkce_state: State<'_, PkceState>,
) -> Result<UserProfile, AppError> {
    // Usually the challenge is returned or predictable. For this simple single-user desktop client, 
    // we just pop the most recent verifier from the map.
    let verifier = {
        let mut state = pkce_state.lock().await;
        let key = state.keys().next().cloned();
        if let Some(k) = key {
            state.remove(&k).unwrap()
        } else {
            return Err(AppError::Auth("OAuth session expired or invalid".into()));
        }
    };

    let (profile, access_token, refresh_token) = supabase.exchange_pkce_code(&auth_code, &verifier).await?;

    // Store tokens in OS keychain (or file on Android)
    Keychain::store_auth_token(&access_token, &refresh_token)?;

    // Fetch subscription
    let sub = supabase
        .fetch_subscription(&access_token, &profile.id)
        .await
        .ok();

    // Update app state (including tokens for mobile fallback)
    {
        let mut state = app_state.write().await;
        state.user = Some(profile.clone());
        state.subscription = sub;
        state.access_token = Some(access_token);
        state.refresh_token = Some(refresh_token);
    }

    Ok(profile)
}

#[derive(serde::Serialize)]
struct ClaimTrialRequest {
    p_trial_key: String,
}

#[tauri::command]
pub async fn activate_trial_key(
    trial_key: String,
    supabase: State<'_, SupabaseState>,
    app_state: State<'_, SharedState>,
) -> Result<UserProfile, AppError> {
    // 1. Authenticate anonymously
    let (profile, access_token, refresh_token) = supabase.login_anonymous().await?;

    // 2. Claim the key via RPC
    let rpc_url = format!("{}/rest/v1/rpc/claim_trial_key", supabase.url());
    let rpc_resp = supabase
        .http()
        .post(&rpc_url)
        .header("apikey", supabase.anon_key())
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&ClaimTrialRequest { p_trial_key: trial_key })
        .send()
        .await?;

    if !rpc_resp.status().is_success() {
        let status = rpc_resp.status();
        let body = rpc_resp.text().await.unwrap_or_default();
        return Err(AppError::Auth(format!("Trial activation failed ({status}): {body}")));
    }

    // 3. Store tokens
    Keychain::store_auth_token(&access_token, &refresh_token)?;

    {
        let mut state = app_state.write().await;
        state.user = Some(profile.clone());
        state.access_token = Some(access_token);
        state.refresh_token = Some(refresh_token);
    }

    Ok(profile)
}

#[cfg(not(mobile))]
#[tauri::command]
pub async fn logout(
    app_state: State<'_, SharedState>,
    tunnel: State<'_, TunnelState>,
    adblock: State<'_, AdblockState>,
    supabase: State<'_, SupabaseState>,
) -> Result<(), AppError> {
    // Terminate session in DB before disconnecting
    {
        let state = app_state.read().await;
        if let Some(ref ci) = state.connection_info {
            if let Ok(Some((access_token, _))) = Keychain::load_auth_tokens() {
                let _ = supabase.terminate_session(&access_token, &ci.session_id).await;
            }
        }
    }

    // Disconnect if connected
    {
        let mut t = tunnel.write().await;
        if t.is_connected() {
            t.disconnect().await?;
        }
    }

    // Stop adblock if running
    {
        let mut ab = adblock.write().await;
        if ab.is_enabled() {
            if let Err(e) = ab.stop().await {
                tracing::error!(error = %e, "Failed to stop adblock on logout");
            }
        }
    }

    // Clear keychain
    Keychain::clear_auth_tokens()?;

    // Clear app state
    {
        let mut state = app_state.write().await;
        state.user = None;
        state.subscription = None;
        state.access_token = None;
        state.refresh_token = None;
        state.connection = ConnectionState::Disconnected;
        state.connection_info = None;
        state.connection_stats = None;
    }

    Ok(())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn logout(
    app_state: State<'_, SharedState>,
    tunnel: State<'_, TunnelState>,
    supabase: State<'_, SupabaseState>,
) -> Result<(), AppError> {
    // Terminate session in DB before disconnecting
    {
        let state = app_state.read().await;
        if let Some(ref ci) = state.connection_info {
            if let Ok(Some((access_token, _))) = Keychain::load_auth_tokens() {
                let _ = supabase.terminate_session(&access_token, &ci.session_id).await;
            }
        }
    }

    // Disconnect if connected
    {
        let mut t = tunnel.write().await;
        if t.is_connected() {
            t.disconnect().await?;
        }
    }

    // Clear keychain
    Keychain::clear_auth_tokens()?;

    // Clear app state
    {
        let mut state = app_state.write().await;
        state.user = None;
        state.subscription = None;
        state.access_token = None;
        state.refresh_token = None;
        state.connection = ConnectionState::Disconnected;
        state.connection_info = None;
        state.connection_stats = None;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_auth_state(
    supabase: State<'_, SupabaseState>,
    app_state: State<'_, SharedState>,
) -> Result<Option<UserProfile>, AppError> {
    // Check if already loaded in state
    {
        let state = app_state.read().await;
        if state.user.is_some() {
            return Ok(state.user.clone());
        }
    }

    // Try to restore from keychain
    let tokens = Keychain::load_auth_tokens().unwrap_or(None);
    if let Some((access_token, refresh_token)) = tokens {
        // Validate the access token
        match supabase.get_user(&access_token).await {
            Ok(profile) => {
                let sub = supabase
                    .fetch_subscription(&access_token, &profile.id)
                    .await
                    .ok();
                let mut state = app_state.write().await;
                state.user = Some(profile.clone());
                state.subscription = sub;
                state.access_token = Some(access_token);
                state.refresh_token = Some(refresh_token);
                return Ok(Some(profile));
            }
            Err(_) => {
                // Try refreshing the token
                match supabase.refresh_token(&refresh_token).await {
                    Ok((new_access, new_refresh)) => {
                        let _ = Keychain::store_auth_token(&new_access, &new_refresh);
                        match supabase.get_user(&new_access).await {
                            Ok(profile) => {
                                let sub = supabase
                                    .fetch_subscription(&new_access, &profile.id)
                                    .await
                                    .ok();
                                let mut state = app_state.write().await;
                                state.user = Some(profile.clone());
                                state.subscription = sub;
                                state.access_token = Some(new_access);
                                state.refresh_token = Some(new_refresh);
                                return Ok(Some(profile));
                            }
                            Err(_) => {
                                let _ = Keychain::clear_auth_tokens();
                            }
                        }
                    }
                    Err(_) => {
                        let _ = Keychain::clear_auth_tokens();
                    }
                }
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn get_subscription(
    supabase: State<'_, SupabaseState>,
    app_state: State<'_, SharedState>,
) -> Result<Subscription, AppError> {
    // Return cached subscription if available
    {
        let state = app_state.read().await;
        if let Some(sub) = &state.subscription {
            return Ok(sub.clone());
        }
    }

    // Otherwise fetch it
    let access_token = get_access_token(&app_state).await?;
    let user_id = {
        let state = app_state.read().await;
        state
            .user
            .as_ref()
            .map(|u| u.id)
            .ok_or_else(|| AppError::Auth("Not logged in".into()))?
    };

    let sub = supabase
        .fetch_subscription(&access_token, &user_id)
        .await?;

    {
        let mut state = app_state.write().await;
        state.subscription = Some(sub.clone());
    }

    Ok(sub)
}

// ─── Server Commands ───

#[tauri::command]
pub async fn fetch_servers(
    supabase: State<'_, SupabaseState>,
    app_state: State<'_, SharedState>,
) -> Result<Vec<RelayServer>, AppError> {
    let access_token = get_access_token(&app_state).await?;

    let servers = supabase.fetch_servers(&access_token).await?;

    {
        let mut state = app_state.write().await;
        state.servers = servers.clone();
    }

    Ok(servers)
}

#[tauri::command]
pub async fn get_recommended_server(
    app_state: State<'_, SharedState>,
) -> Result<Option<RelayServer>, AppError> {
    let state = app_state.read().await;

    // Simple recommendation: pick the server with the lowest client load
    let recommended = state
        .servers
        .iter()
        .filter(|s| s.status == "online")
        .min_by_key(|s| {
            // Load percentage * 100 for integer comparison
            if s.max_clients > 0 {
                (s.current_clients * 100) / s.max_clients
            } else {
                100
            }
        })
        .cloned();

    Ok(recommended)
}

// ─── Connection Commands ───

#[tauri::command]
pub async fn connect(
    entry_server_id: Option<Uuid>,
    exit_server_id: Option<Uuid>,
    supabase: State<'_, SupabaseState>,
    app_state: State<'_, SharedState>,
    tunnel: State<'_, TunnelState>,
    app_handle: tauri::AppHandle,
) -> Result<ConnectionInfo, AppError> {
    // Check if already connected
    {
        let t = tunnel.read().await;
        if t.is_connected() {
            return Err(AppError::AlreadyConnected);
        }
    }

    // Update state to connecting
    emit_connection_state(&app_handle, ConnectionState::Connecting);
    {
        let mut state = app_state.write().await;
        state.connection = ConnectionState::Connecting;
    }

    let access_token = get_access_token(&app_state).await?;

    // Generate or load WireGuard keypair
    let (private_key_bytes, public_key_b64) = get_or_create_wg_keypair()?;

    // Read bonding mode preference
    let bonding_mode = {
        if let Ok(prefs) = crate::preferences::load_preferences_from_disk() {
            if prefs.bonding_mode == "None" {
                None
            } else {
                Some(prefs.bonding_mode)
            }
        } else {
            None  // Default to direct UDP when preferences can't be loaded
        }
    };

    // Enforce subscription: block bonding for plans that don't support it
    if bonding_mode.is_some() {
        let state = app_state.read().await;
        if let Some(sub) = &state.subscription {
            if !sub.plan.can_bond {
                emit_connection_state(&app_handle, ConnectionState::Error {
                    message: "Channel bonding requires a Pro or Enterprise plan".to_string(),
                });
                return Err(AppError::SubscriptionRequired(
                    "Channel bonding requires a Pro or Enterprise plan. Upgrade to unlock this feature.".to_string(),
                ));
            }
        }
    }

    // Request config from edge function
    let config = supabase
        .generate_client_config(
            &access_token,
            &public_key_b64,
            entry_server_id,
            exit_server_id,
            bonding_mode.clone(),
        )
        .await
        .map_err(|e| {
            emit_connection_state(&app_handle, ConnectionState::Error { message: e.to_string() });
            e
        })?;

    // Parse the response
    let assigned_ip: std::net::Ipv4Addr = config["assigned_ip"]
        .as_str()
        .ok_or_else(|| AppError::Network("Missing assigned_ip in response".into()))?
        .parse()
        .map_err(|e| AppError::Network(format!("Invalid assigned_ip: {e}")))?;

    let server_public_key_b64 = config["wireguard_config"]["peer"]["public_key"]
        .as_str()
        .ok_or_else(|| AppError::Network("Missing server public_key in response".into()))?;

    let endpoint_str = config["wireguard_config"]["peer"]["endpoint"]
        .as_str()
        .ok_or_else(|| AppError::Network("Missing endpoint in response".into()))?;

    let endpoint: std::net::SocketAddr = endpoint_str
        .parse()
        .map_err(|e| AppError::Network(format!("Invalid endpoint: {e}")))?;

    let dns_str = config["wireguard_config"]["interface"]["dns"]
        .as_str()
        .unwrap_or("1.1.1.1, 8.8.8.8");
    let dns_servers: Vec<String> = dns_str.split(',').map(|s| s.trim().to_string()).collect();

    // Decode server public key
    use base64::Engine;
    let server_pub_bytes: [u8; 32] = base64::engine::general_purpose::STANDARD
        .decode(server_public_key_b64)
        .map_err(|e| AppError::Network(format!("Invalid server public key: {e}")))?
        .try_into()
        .map_err(|_| AppError::Network("Server public key must be 32 bytes".into()))?;

    let session_id: Uuid = config["session_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .unwrap_or_else(Uuid::new_v4);

    let bonding_session_token = config["bonding_session_token"].as_str().map(|s| s.to_string());
    let bonding_port = config["bonding_port"].as_u64().map(|p| p as u16);

    // Start the tunnel
    #[cfg(not(mobile))]
    {
        let mut t = tunnel.write().await;
        t.connect(
            &private_key_bytes,
            &server_pub_bytes,
            endpoint,
            assigned_ip,
            &dns_servers,
            session_id,
            bonding_mode.clone(),
            bonding_session_token.clone(),
            bonding_port,
        )
        .await
        .map_err(|e| {
            emit_connection_state(&app_handle, ConnectionState::Error { message: e.to_string() });
            e
        })?;
    }

    #[cfg(mobile)]
    {
        use crate::vpn_plugin::{VpnConfig, VpnPluginExt};

        // Call native VPN plugin to create TUN device (no tunnel lock needed)
        let vpn_config = VpnConfig {
            assigned_ip: assigned_ip.to_string(),
            subnet_mask: "255.255.255.255".to_string(),
            dns_servers: dns_servers.clone(),
            mtu: 1420,
            server_endpoint: endpoint.to_string(),
            session_name: "Tunnely VPN".to_string(),
        };

        let result = app_handle.vpn_start(&vpn_config)
            .map_err(|e| {
                emit_connection_state(&app_handle, ConnectionState::Error { message: e.clone() });
                AppError::Tunnel(e)
            })?;

        if !result.success {
            let msg = result.error.unwrap_or_else(|| "Unknown VPN error".to_string());
            emit_connection_state(&app_handle, ConnectionState::Error { message: msg.clone() });
            return Err(AppError::Tunnel(msg));
        }

        // Get the DNS filter for ad blocking (no tunnel lock needed)
        let dns_filter = {
            if let Some(mobile_adblock) = app_handle.try_state::<MobileAdblockState>() {
                let service = mobile_adblock.read().await;
                Some(service.filter())
            } else {
                None
            }
        };

        // Only acquire tunnel lock for the actual connect call
        let mut t = tunnel.write().await;
        t.connect(
            &private_key_bytes,
            &server_pub_bytes,
            endpoint,
            assigned_ip,
            &dns_servers,
            session_id,
            None, // No bonding on mobile
            None,
            None,
            result.tun_fd,
            dns_filter,
        )
        .await
        .map_err(|e| {
            emit_connection_state(&app_handle, ConnectionState::Error { message: e.to_string() });
            e
        })?;
    }

    // Build connection info
    let conn_info = ConnectionInfo {
        session_id,
        assigned_ip: assigned_ip.to_string(),
        server_public_key: server_public_key_b64.to_string(),
        endpoint: endpoint_str.to_string(),
        entry_server: parse_server_summary(&config["entry_server"]),
        exit_server: parse_server_summary(&config["exit_server"]),
        relay_path: config["relay_path"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().and_then(|s| s.parse().ok()))
                    .collect()
            })
            .unwrap_or_default(),
        bonding_enabled: bonding_mode.is_some() && bonding_session_token.is_some(),
        bonding_session_token,
        dns: dns_servers,
    };

    // Update state
    {
        let mut state = app_state.write().await;
        state.connection = ConnectionState::Connected;
        state.connection_info = Some(conn_info.clone());
    }

    emit_connection_state(&app_handle, ConnectionState::Connected);

    Ok(conn_info)
}

#[tauri::command]
pub async fn disconnect(
    app_state: State<'_, SharedState>,
    tunnel: State<'_, TunnelState>,
    supabase: State<'_, SupabaseState>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    emit_connection_state(&app_handle, ConnectionState::Disconnecting);

    // Get session info before clearing it
    let session_id = {
        let state = app_state.read().await;
        state.connection_info.as_ref().map(|ci| ci.session_id)
    };

    // Terminate session in Supabase
    if let Some(sid) = session_id {
        if let Ok(Some((access_token, _))) = Keychain::load_auth_tokens() {
            if let Err(e) = supabase.terminate_session(&access_token, &sid).await {
                tracing::warn!(error = %e, "Failed to terminate session in DB (will be cleaned up later)");
            }
        }
    }

    {
        let mut t = tunnel.write().await;
        t.disconnect().await?;
    }

    // Stop the native VPN service on mobile
    #[cfg(mobile)]
    {
        use crate::vpn_plugin::VpnPluginExt;
        if let Err(e) = app_handle.vpn_stop() {
            tracing::warn!(error = %e, "Failed to stop native VPN service");
        }
    }

    {
        let mut state = app_state.write().await;
        state.connection = ConnectionState::Disconnected;
        state.connection_info = None;
        state.connection_stats = None;
    }

    emit_connection_state(&app_handle, ConnectionState::Disconnected);

    Ok(())
}

#[tauri::command]
pub async fn get_connection_status(
    app_state: State<'_, SharedState>,
    tunnel: State<'_, TunnelState>,
) -> Result<ConnectionStatus, AppError> {
    let state = app_state.read().await;

    let stats = if state.connection == ConnectionState::Connected {
        let t = tunnel.read().await;
        Some(t.get_stats().await)
    } else {
        None
    };

    Ok(ConnectionStatus {
        state: state.connection.clone(),
        info: state.connection_info.clone(),
        stats,
    })
}

// ─── Helpers ───

fn emit_connection_state(app_handle: &tauri::AppHandle, state: ConnectionState) {
    let _ = app_handle.emit("connection-state-changed", &state);
}

async fn get_access_token(app_state: &SharedState) -> Result<String, AppError> {
    // Try keychain first (persistent storage)
    match Keychain::load_auth_tokens() {
        Ok(Some((access_token, _))) => return Ok(access_token),
        Ok(None) => {}
        Err(e) => {
            tracing::warn!("Keychain load failed, falling back to memory: {e}");
        }
    }
    // Fallback: check in-memory state (covers Android where keychain may not work)
    let state = app_state.read().await;
    if let Some(ref token) = state.access_token {
        return Ok(token.clone());
    }
    Err(AppError::Auth("Not logged in".into()))
}

fn get_or_create_wg_keypair() -> Result<([u8; 32], String), AppError> {
    use base64::Engine;

    // Try to load existing private key
    if let Some(existing_key_b64) = Keychain::load_wg_private_key()? {
        let key_bytes: [u8; 32] = base64::engine::general_purpose::STANDARD
            .decode(&existing_key_b64)
            .map_err(|e| AppError::Other(format!("Invalid stored WG key: {e}")))?
            .try_into()
            .map_err(|_| AppError::Other("Stored WG key is not 32 bytes".into()))?;

        let secret = x25519_dalek::StaticSecret::from(key_bytes);
        let public = x25519_dalek::PublicKey::from(&secret);
        let pub_b64 = base64::engine::general_purpose::STANDARD.encode(public.as_bytes());

        return Ok((key_bytes, pub_b64));
    }

    // Generate a new keypair
    let secret = x25519_dalek::StaticSecret::random_from_rng(rand::thread_rng());
    let public = x25519_dalek::PublicKey::from(&secret);

    let priv_bytes: [u8; 32] = secret.to_bytes();
    let priv_b64 = base64::engine::general_purpose::STANDARD.encode(priv_bytes);
    let pub_b64 = base64::engine::general_purpose::STANDARD.encode(public.as_bytes());

    // Store in keychain
    Keychain::store_wg_private_key(&priv_b64)?;

    Ok((priv_bytes, pub_b64))
}

// ─── Location ───

#[tauri::command]
pub async fn get_user_location(
    supabase: State<'_, SupabaseState>,
) -> Result<UserLocation, AppError> {
    let resp = supabase
        .http()
        .get("https://ipapi.co/json/")
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(AppError::Network("Failed to get user location".into()));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| {
        AppError::Network(format!("Failed to parse location response: {e}"))
    })?;

    Ok(UserLocation {
        latitude: data["latitude"].as_f64().unwrap_or(0.0),
        longitude: data["longitude"].as_f64().unwrap_or(0.0),
        city: data["city"].as_str().unwrap_or("Unknown").to_string(),
        country_code: data["country_code"].as_str().unwrap_or("??").to_string(),
    })
}

// ─── Latency ───

#[tauri::command]
pub async fn ping_servers(
    app_state: State<'_, SharedState>,
) -> Result<Vec<ServerLatency>, AppError> {
    let servers = {
        let state = app_state.read().await;
        state.servers.clone()
    };

    let results = latency::ping_all_servers(&servers).await;
    Ok(results)
}

// ─── Favorites ───

#[tauri::command]
pub async fn load_favorites() -> Result<Vec<Uuid>, AppError> {
    preferences::load_favorites_from_disk()
}

#[tauri::command]
pub async fn save_favorites(server_ids: Vec<Uuid>) -> Result<(), AppError> {
    preferences::save_favorites_to_disk(&server_ids)
}

// ─── Recents ───

#[tauri::command]
pub async fn load_recents() -> Result<Vec<RecentConnection>, AppError> {
    preferences::load_recents_from_disk()
}

#[tauri::command]
pub async fn save_recents(recents: Vec<RecentConnection>) -> Result<(), AppError> {
    preferences::save_recents_to_disk(&recents)
}

// ─── Preferences ───

#[tauri::command]
pub async fn load_preferences() -> Result<AppPreferences, AppError> {
    preferences::load_preferences_from_disk()
}

#[tauri::command]
pub async fn save_preferences(prefs: AppPreferences) -> Result<(), AppError> {
    preferences::save_preferences_to_disk(&prefs)
}

// ─── Bonding ───

#[derive(serde::Serialize)]
pub struct LocalInterface {
    pub name: String,
    pub interface_type: String,
    pub ip: String,
}

#[tauri::command]
pub async fn get_local_interfaces() -> Result<Vec<LocalInterface>, AppError> {
    let interfaces = if_addrs::get_if_addrs().unwrap_or_default();
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    for iface in interfaces {
        if iface.is_loopback()
            || iface.name.starts_with("utun")
            || iface.name.starts_with("tun")
            || iface.name.starts_with("wg")
            || iface.name.starts_with("vEthernet")
            || iface.name.starts_with("lo")
            || iface.name.to_lowercase().contains("wintun")
        {
            continue;
        }
        // IPv4 only, deduplicate by name
        if let std::net::IpAddr::V4(v4) = iface.addr.ip() {
            if !seen.contains(&iface.name) {
                seen.insert(iface.name.clone());
                let iface_type = crate::tunnel::bonding::channel_manager::ChannelManager::classify_interface(&iface.name);
                let type_str = match iface_type {
                    relay_common::bonding::InterfaceType::Ethernet => "Ethernet",
                    relay_common::bonding::InterfaceType::WiFi => "WiFi",
                    relay_common::bonding::InterfaceType::Cellular => "Cellular",
                    relay_common::bonding::InterfaceType::Unknown => "Unknown",
                };
                result.push(LocalInterface {
                    name: iface.name,
                    interface_type: type_str.to_string(),
                    ip: v4.to_string(),
                });
            }
        }
    }
    Ok(result)
}

#[derive(serde::Serialize)]
pub struct ChannelStatus {
    pub id: u16,
    pub name: String,
    pub interface_type: String,
    pub state: String,
    pub rtt_ms: u32,
    pub throughput_kbps: u64,
    pub loss_pct: f32,
    pub enabled: bool,
}

#[tauri::command]
pub async fn get_bonding_status(
    tunnel: tauri::State<'_, crate::TunnelState>,
) -> Result<Vec<ChannelStatus>, AppError> {
    let t = tunnel.read().await;
    if let Some(cm_arc) = &t.bonding_channels {
        let cm = cm_arc.read().await;
        let mut statuses = Vec::new();
        for channel in cm.get_all_channels() {
            let state_str = match channel.state {
                crate::tunnel::bonding::channel::ChannelState::Initializing => "Initializing",
                crate::tunnel::bonding::channel::ChannelState::Active => "Active",
                crate::tunnel::bonding::channel::ChannelState::Degraded => "Degraded",
                crate::tunnel::bonding::channel::ChannelState::Failed => "Failed",
                crate::tunnel::bonding::channel::ChannelState::Disabled => "Disabled",
            };
            let iface_type = match &channel.interface_type {
                relay_common::bonding::InterfaceType::Ethernet => "Ethernet",
                relay_common::bonding::InterfaceType::WiFi => "WiFi",
                relay_common::bonding::InterfaceType::Cellular => "Cellular",
                relay_common::bonding::InterfaceType::Unknown => "Unknown",
            };
            statuses.push(ChannelStatus {
                id: channel.id,
                name: channel.interface_name.clone(),
                interface_type: iface_type.to_string(),
                state: state_str.to_string(),
                rtt_ms: channel.quality.rtt_us / 1000,
                throughput_kbps: channel.quality.throughput_bps / 1000,
                loss_pct: channel.quality.loss_rate * 100.0,
                enabled: channel.state != crate::tunnel::bonding::channel::ChannelState::Disabled,
            });
        }
        Ok(statuses)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn set_bonding_mode(
    mode: String,
    tunnel: tauri::State<'_, crate::TunnelState>,
) -> Result<(), AppError> {
    // Save to preferences
    let mut prefs = crate::preferences::load_preferences_from_disk().unwrap_or_default();
    prefs.bonding_mode = mode.clone();
    crate::preferences::save_preferences_to_disk(&prefs)?;

    // Live-switch the active tunnel if connected
    let t = tunnel.read().await;
    if let Some(layer) = &t.bonding_layer {
        let new_mode = match mode.as_str() {
            "Speed" => relay_common::bonding::BondingMode::Speed,
            "Redundant" => relay_common::bonding::BondingMode::Redundant,
            "Quality" => relay_common::bonding::BondingMode::Quality,
            _ => return Err(AppError::Config("Invalid bonding mode".into())),
        };
        layer.set_mode(new_mode).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_channel_enabled(
    channel_id: u16,
    enabled: bool,
    tunnel: tauri::State<'_, crate::TunnelState>,
) -> Result<(), AppError> {
    let t = tunnel.read().await;
    if let Some(cm_arc) = &t.bonding_channels {
        let mut cm = cm_arc.write().await;
        if let Some(channel) = cm.get_channel_mut(channel_id) {
            if enabled {
                channel.state = crate::tunnel::bonding::channel::ChannelState::Active;
            } else {
                channel.state = crate::tunnel::bonding::channel::ChannelState::Disabled;
            }
        }
    }
    Ok(())
}

// ─── Helpers ───

fn parse_server_summary(value: &serde_json::Value) -> ServerSummary {
    ServerSummary {
        id: value["id"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(Uuid::nil),
        hostname: value["hostname"].as_str().unwrap_or("unknown").to_string(),
        city: value["city"].as_str().unwrap_or("unknown").to_string(),
        region: value["region"].as_str().unwrap_or("unknown").to_string(),
        country_code: value["country_code"]
            .as_str()
            .unwrap_or("??")
            .to_string(),
    }
}

// ─── Adblock Commands ───

// Desktop: real adblock implementation
#[cfg(not(mobile))]
mod adblock_commands {
    use super::*;

    #[tauri::command]
    pub async fn enable_adblock(
        app_state: State<'_, SharedState>,
        adblock: State<'_, AdblockState>,
    ) -> Result<(), AppError> {
        let state = app_state.read().await;
        let is_pro = state
            .subscription
            .as_ref()
            .map(|s| s.plan.slug.as_str() != "free")
            .unwrap_or(false);
            
        if !is_pro {
            return Err(AppError::Other("Pro subscription required to enable ad blocker".into()));
        }

        let mut ab = adblock.write().await;
        ab.start().await.map_err(|e| AppError::Other(format!("Failed to start adblock: {e}")))?;
        Ok(())
    }

    #[tauri::command]
    pub async fn disable_adblock(
        adblock: State<'_, AdblockState>,
    ) -> Result<(), AppError> {
        let mut ab = adblock.write().await;
        ab.stop().await.map_err(|e| AppError::Other(format!("Failed to stop adblock: {e}")))?;
        Ok(())
    }

    #[tauri::command]
    pub async fn get_adblock_status(
        adblock: State<'_, AdblockState>,
    ) -> Result<AdblockStatus, AppError> {
        let ab = adblock.read().await;
        Ok(AdblockStatus {
            enabled: ab.is_enabled(),
            ca_installed: false,
            ca_cert_path: ab.ca_cert_path(),
        })
    }

    #[tauri::command]
    pub async fn get_adblock_stats(
        adblock: State<'_, AdblockState>,
    ) -> Result<crate::adblock::stats::AdblockStatsSnapshot, AppError> {
        let ab = adblock.read().await;
        Ok(ab.get_stats().await)
    }

    #[tauri::command]
    pub async fn install_adblock_ca(
        app_state: State<'_, SharedState>,
        adblock: State<'_, AdblockState>,
    ) -> Result<String, AppError> {
        let state = app_state.read().await;
        let is_pro = state.subscription.as_ref().map(|s| s.plan.slug.as_str() != "free").unwrap_or(false);
        if !is_pro {
            return Err(AppError::Other("Pro subscription required for cosmetic filtering (HTTPS)".into()));
        }

        let ab = adblock.read().await;
        ab.install_root_ca()
            .map_err(|e| AppError::Other(format!("Failed to install Root CA: {e}")))
    }

    #[tauri::command]
    pub async fn get_adblock_ca_path(
        adblock: State<'_, AdblockState>,
    ) -> Result<String, AppError> {
        let ab = adblock.read().await;
        Ok(ab.ca_cert_path())
    }

    #[tauri::command]
    pub async fn update_adblock_filters(
        app_state: State<'_, SharedState>,
        adblock: State<'_, AdblockState>,
    ) -> Result<usize, AppError> {
        let state = app_state.read().await;
        let is_pro = state.subscription.as_ref().map(|s| s.plan.slug.as_str() != "free").unwrap_or(false);
        if !is_pro {
            return Err(AppError::Other("Pro subscription required to update ad blocker filters".into()));
        }

        let ab = adblock.read().await;
        ab.update_filter_lists()
            .await
            .map_err(|e| AppError::Other(format!("Failed to update filters: {e}")))
    }

    #[tauri::command]
    pub async fn get_adblock_whitelist(
        adblock: State<'_, AdblockState>,
    ) -> Result<Vec<String>, AppError> {
        let ab = adblock.read().await;
        Ok(ab.get_whitelist().await)
    }

    #[tauri::command]
    pub async fn add_adblock_whitelist(
        domain: String,
        app_state: State<'_, SharedState>,
        adblock: State<'_, AdblockState>,
    ) -> Result<(), AppError> {
        let state = app_state.read().await;
        let is_pro = state.subscription.as_ref().map(|s| s.plan.slug.as_str() != "free").unwrap_or(false);
        if !is_pro {
            return Err(AppError::Other("Pro subscription required to customize whitelist".into()));
        }

        let ab = adblock.read().await;
        ab.add_to_whitelist(domain)
            .await
            .map_err(|e| AppError::Other(format!("Failed to add to whitelist: {e}")))
    }

    #[tauri::command]
    pub async fn remove_adblock_whitelist(
        domain: String,
        app_state: State<'_, SharedState>,
        adblock: State<'_, AdblockState>,
    ) -> Result<(), AppError> {
        let state = app_state.read().await;
        let is_pro = state.subscription.as_ref().map(|s| s.plan.slug.as_str() != "free").unwrap_or(false);
        if !is_pro {
            return Err(AppError::Other("Pro subscription required to customize whitelist".into()));
        }

        let ab = adblock.read().await;
        ab.remove_from_whitelist(&domain)
            .await
            .map_err(|e| AppError::Other(format!("Failed to remove from whitelist: {e}")))
    }

    #[tauri::command]
    pub async fn get_adblock_filter_level(
        adblock: State<'_, AdblockState>,
    ) -> Result<String, AppError> {
        let ab = adblock.read().await;
        Ok(ab.get_filter_level())
    }

    #[tauri::command]
    pub async fn set_adblock_filter_level(
        level: String,
        app_state: State<'_, SharedState>,
        adblock: State<'_, AdblockState>,
    ) -> Result<(), AppError> {
        let state = app_state.read().await;
        let is_pro = state.subscription.as_ref().map(|s| s.plan.slug.as_str() != "free").unwrap_or(false);
        if !is_pro {
            return Err(AppError::Other("Pro subscription required to change filter level".into()));
        }

        let mut ab = adblock.write().await;
        ab.set_filter_level(&level)
            .await
            .map_err(|e| AppError::Other(format!("Failed to set filter level: {e}")))
    }

    #[tauri::command]
    pub async fn set_adblock_debug_logging(
        enabled: bool,
        app_state: State<'_, SharedState>,
        adblock: State<'_, AdblockState>,
    ) -> Result<(), AppError> {
        let state = app_state.read().await;
        let is_pro = state.subscription.as_ref().map(|s| s.plan.slug.as_str() != "free").unwrap_or(false);
        if !is_pro {
            return Err(AppError::Other("Pro subscription required for debug logging".into()));
        }

        let ab = adblock.read().await;
        ab.set_debug_logging(enabled).await;
        Ok(())
    }

    #[tauri::command]
    pub async fn get_adblock_debug_logging(
        adblock: State<'_, AdblockState>,
    ) -> Result<bool, AppError> {
        let ab = adblock.read().await;
        Ok(ab.is_debug_logging().await)
    }

    #[tauri::command]
    pub async fn reset_adblock_stats(
        adblock: State<'_, AdblockState>,
    ) -> Result<(), AppError> {
        let ab = adblock.read().await;
        ab.reset_stats().await;
        Ok(())
    }
}

// Mobile: DNS-based adblock commands using MobileAdblockService
#[cfg(mobile)]
mod adblock_commands {
    use super::*;

    #[tauri::command]
    pub async fn enable_adblock(
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<(), AppError> {
        let ab = adblock.read().await;
        ab.enable()
            .await
            .map_err(|e| AppError::Other(format!("Failed to enable DNS ad blocker: {e}")))
    }

    #[tauri::command]
    pub async fn disable_adblock(
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<(), AppError> {
        let ab = adblock.read().await;
        ab.disable().await;
        Ok(())
    }

    #[tauri::command]
    pub async fn get_adblock_status(
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<AdblockStatus, AppError> {
        let ab = adblock.read().await;
        Ok(AdblockStatus {
            enabled: ab.is_enabled().await,
            ca_installed: false, // DNS filtering doesn't use CA
            ca_cert_path: String::new(),
        })
    }

    #[tauri::command]
    pub async fn get_adblock_stats(
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<serde_json::Value, AppError> {
        let ab = adblock.read().await;
        let stats = ab.get_stats();
        Ok(serde_json::json!({
            "requests_total": stats.queries_total,
            "requests_blocked": stats.queries_blocked,
            "bytes_saved": 0,
            "block_rate_percent": stats.block_rate_percent,
            "recent_blocked": [],
            "debug_logging_enabled": false
        }))
    }

    #[tauri::command]
    pub async fn install_adblock_ca() -> Result<String, AppError> {
        Err(AppError::Other("Certificate installation is not needed on mobile  - DNS-level filtering is used instead".into()))
    }

    #[tauri::command]
    pub async fn get_adblock_ca_path() -> Result<String, AppError> {
        Err(AppError::Other("Certificate installation is not needed on mobile  - DNS-level filtering is used instead".into()))
    }

    #[tauri::command]
    pub async fn update_adblock_filters(
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<usize, AppError> {
        let ab = adblock.read().await;
        ab.update_filter_lists()
            .await
            .map_err(|e| AppError::Other(format!("Failed to update filters: {e}")))
    }

    #[tauri::command]
    pub async fn get_adblock_whitelist(
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<Vec<String>, AppError> {
        let ab = adblock.read().await;
        Ok(ab.get_whitelist().await)
    }

    #[tauri::command]
    pub async fn add_adblock_whitelist(
        domain: String,
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<(), AppError> {
        let ab = adblock.read().await;
        ab.add_to_whitelist(domain).await;
        Ok(())
    }

    #[tauri::command]
    pub async fn remove_adblock_whitelist(
        domain: String,
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<(), AppError> {
        let ab = adblock.read().await;
        ab.remove_from_whitelist(&domain).await;
        Ok(())
    }

    #[tauri::command]
    pub async fn get_adblock_filter_level(
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<String, AppError> {
        let ab = adblock.read().await;
        Ok(ab.get_filter_level().await)
    }

    #[tauri::command]
    pub async fn set_adblock_filter_level(
        level: String,
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<(), AppError> {
        let ab = adblock.read().await;
        ab.set_filter_level(&level)
            .await
            .map_err(|e| AppError::Other(format!("Failed to set filter level: {e}")))
    }

    #[tauri::command]
    pub async fn set_adblock_debug_logging(_enabled: bool) -> Result<(), AppError> {
        // Debug logging is desktop-only (requires the MITM proxy)
        Ok(())
    }

    #[tauri::command]
    pub async fn get_adblock_debug_logging() -> Result<bool, AppError> {
        Ok(false)
    }

    #[tauri::command]
    pub async fn reset_adblock_stats(
        adblock: State<'_, MobileAdblockState>,
    ) -> Result<(), AppError> {
        let ab = adblock.read().await;
        ab.reset_stats();
        Ok(())
    }
}

// Re-export adblock commands
pub use adblock_commands::*;

#[derive(serde::Serialize)]
pub struct AdblockStatus {
    pub enabled: bool,
    pub ca_installed: bool,
    pub ca_cert_path: String,
}

// ─── Update Commands ───

// Desktop: real updater
#[cfg(not(mobile))]
mod update_commands {
    use super::*;

    #[tauri::command]
    pub async fn check_for_updates() -> Result<crate::updater::UpdateInfo, AppError> {
        crate::updater::check_for_updates()
            .await
            .map_err(|e| AppError::Other(e))
    }

    #[tauri::command]
    pub async fn download_update(
        download_url: String,
        file_name: String,
        app_handle: tauri::AppHandle,
    ) -> Result<String, AppError> {
        let path = crate::updater::download_update(&app_handle, &download_url, &file_name)
            .await
            .map_err(|e| AppError::Other(e))?;
        Ok(path.to_string_lossy().to_string())
    }

    #[tauri::command]
    pub async fn install_update(file_path: String) -> Result<(), AppError> {
        crate::updater::install_update(&file_path)
            .map_err(|e| AppError::Other(e))
    }
}

// Mobile: stub updater commands
#[cfg(mobile)]
mod update_commands {
    use super::*;

    #[derive(serde::Serialize)]
    pub struct UpdateInfo {
        pub update_available: bool,
        pub latest_version: String,
        pub download_url: String,
        pub release_notes: String,
        pub file_name: String,
        pub file_size: u64,
    }

    #[tauri::command]
    pub async fn check_for_updates() -> Result<UpdateInfo, AppError> {
        Ok(UpdateInfo {
            update_available: false,
            latest_version: env!("CARGO_PKG_VERSION").to_string(),
            download_url: String::new(),
            release_notes: String::new(),
            file_name: String::new(),
            file_size: 0,
        })
    }
    #[tauri::command]
    pub async fn download_update(_download_url: String, _file_name: String) -> Result<String, AppError> {
        Err(AppError::Other("Updates are managed through the app store on mobile".into()))
    }
    #[tauri::command]
    pub async fn install_update(_file_path: String) -> Result<(), AppError> {
        Err(AppError::Other("Updates are managed through the app store on mobile".into()))
    }
}

pub use update_commands::*;

// ─── In-App Purchase Commands ───

#[cfg(mobile)]
mod iap_commands {
    use super::*;
    /// Get available subscription products from the platform store.
    ///
    /// Returns product IDs, prices, and billing periods for the user's locale.
    #[tauri::command]
    pub async fn get_iap_products(
        supabase: State<'_, SupabaseState>,
    ) -> Result<Vec<serde_json::Value>, AppError> {
        // Fetch plans from Supabase to get platform product IDs
        let response = supabase
            .http()
            .get(format!(
                "{}/rest/v1/plans?select=slug,apple_product_id_monthly,apple_product_id_yearly,google_product_id_monthly,google_product_id_yearly&is_active=eq.true&slug=neq.free",
                supabase.url()
            ))
            .header("apikey", supabase.anon_key())
            .header("Authorization", format!("Bearer {}", supabase.anon_key()))
            .send()
            .await
            .map_err(|e| AppError::Other(format!("Failed to fetch plans: {e}")))?;

        let plans: Vec<serde_json::Value> = response.json().await
            .map_err(|e| AppError::Other(format!("Failed to parse plans: {e}")))?;

        // Collect platform-specific product IDs
        let mut product_ids = Vec::new();
        for plan in &plans {
            #[cfg(target_os = "android")]
            {
                if let Some(id) = plan.get("google_product_id_monthly").and_then(|v| v.as_str()) {
                    product_ids.push(id.to_string());
                }
                if let Some(id) = plan.get("google_product_id_yearly").and_then(|v| v.as_str()) {
                    product_ids.push(id.to_string());
                }
            }
            #[cfg(target_os = "ios")]
            {
                if let Some(id) = plan.get("apple_product_id_monthly").and_then(|v| v.as_str()) {
                    product_ids.push(id.to_string());
                }
                if let Some(id) = plan.get("apple_product_id_yearly").and_then(|v| v.as_str()) {
                    product_ids.push(id.to_string());
                }
            }
        }

        // Return the IDs so the frontend can query the native store
        // The actual store query happens via the native IAP plugin (Kotlin/Swift)
        Ok(plans)
    }

    /// Validate a completed purchase with the backend.
    ///
    /// After the native purchase flow completes, the receipt must be
    /// validated server-side to prevent tampering.
    #[tauri::command]
    pub async fn validate_iap_purchase(
        receipt_data: String,
        product_id: String,
        supabase: State<'_, SupabaseState>,
        app_state: State<'_, SharedState>,
    ) -> Result<serde_json::Value, AppError> {
        let provider = if cfg!(target_os = "android") {
            "google"
        } else {
            "apple"
        };

        // Get current auth token from keychain or memory
        let access_token = get_access_token(&app_state).await?;

        let request_body = serde_json::json!({
            "provider": provider,
            "receipt_data": receipt_data,
            "product_id": product_id,
        });

        let response = supabase
            .http()
            .post(format!(
                "{}/functions/v1/validate-mobile-purchase",
                supabase.url()
            ))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("apikey", supabase.anon_key())
            .json(&request_body)
            .send()
            .await
            .map_err(|e| AppError::Other(format!("Validation request failed: {e}")))?;

        if !response.status().is_success() {
            let error_body = response.text().await.unwrap_or_default();
            return Err(AppError::Other(format!("Purchase validation failed: {error_body}")));
        }

        let result: serde_json::Value = response.json().await
            .map_err(|e| AppError::Other(format!("Failed to parse validation response: {e}")))?;

        // Update local subscription state if validation succeeded
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            if let Some(plan) = result.get("plan") {
                let slug = plan.get("slug").and_then(|v| v.as_str()).unwrap_or("free");
                tracing::info!(plan = %slug, "Mobile purchase validated  - subscription activated");
            }
        }

        Ok(result)
    }

    /// Restore previous purchases (e.g., after app reinstall).
    ///
    /// The frontend calls the native restore API, then validates each
    /// restored receipt with the backend.
    #[tauri::command]
    pub async fn restore_iap_purchases() -> Result<String, AppError> {
        // The actual restore is done by the native plugin (Kotlin/Swift).
        // This command exists as a Rust-side hook for post-restore validation.
        // The frontend should:
        //   1. Call the native restorePurchases via the IAP plugin
        //   2. For each restored purchase, call validate_iap_purchase
        Ok("Call the native IAP plugin restorePurchases method, then validate each receipt".into())
    }
}

#[cfg(not(mobile))]
mod iap_commands {
    use super::*;

    #[tauri::command]
    pub async fn get_iap_products() -> Result<Vec<serde_json::Value>, AppError> {
        Err(AppError::Other("In-app purchases are only available on mobile. Use Stripe on desktop.".into()))
    }

    #[tauri::command]
    pub async fn validate_iap_purchase(
        _receipt_data: String,
        _product_id: String,
    ) -> Result<serde_json::Value, AppError> {
        Err(AppError::Other("In-app purchases are only available on mobile. Use Stripe on desktop.".into()))
    }

    #[tauri::command]
    pub async fn restore_iap_purchases() -> Result<String, AppError> {
        Err(AppError::Other("In-app purchases are only available on mobile. Use Stripe on desktop.".into()))
    }
}

pub use iap_commands::*;
