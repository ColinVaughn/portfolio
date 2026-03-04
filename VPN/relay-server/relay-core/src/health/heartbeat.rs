use relay_common::types::{Heartbeat, ServerStatus};
use std::sync::Arc;
use tokio::time::Duration;
use uuid::Uuid;

use crate::health::metrics as prom;
use crate::supabase::client::SupabaseClient;
use crate::wg::peer::PeerManager;

/// Background task: send periodic heartbeats to Supabase
pub async fn run_heartbeat_loop(
    server_id: Uuid,
    supabase: Arc<SupabaseClient>,
    peer_manager: Arc<PeerManager>,
    interval_secs: u64,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));

    loop {
        interval.tick().await;

        let client_count = peer_manager.client_count().await as i32;

        let heartbeat = Heartbeat {
            status: ServerStatus::Online,
            current_clients: client_count,
            last_heartbeat: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        if let Err(e) = supabase.send_heartbeat(&server_id, &heartbeat).await {
            tracing::error!(error = %e, "Failed to send heartbeat");
            prom::record_heartbeat_failed();
        } else {
            tracing::trace!(clients = client_count, "Heartbeat sent");
            prom::record_heartbeat_sent();
        }
    }
}
