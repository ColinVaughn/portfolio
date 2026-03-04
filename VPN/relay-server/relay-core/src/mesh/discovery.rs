use anyhow::Result;
use relay_common::types::{MeshPeer, RelayServer};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::supabase::client::SupabaseClient;
use crate::wg::interface::WgInterface;
use crate::wg::peer::mesh_ip_from_uuid;

/// Manages discovery and tracking of mesh peers
pub struct MeshDiscovery {
    /// Our own server ID
    server_id: Uuid,
    /// Currently known peers
    peers: Arc<RwLock<HashMap<Uuid, MeshPeer>>>,
}

impl MeshDiscovery {
    pub fn new(server_id: Uuid) -> Self {
        Self {
            server_id,
            peers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Discover peers from Supabase and sync with mesh interface
    pub async fn refresh_peers(
        &self,
        supabase: &SupabaseClient,
        mesh_interface: &WgInterface,
    ) -> Result<()> {
        let online_servers = supabase.get_online_servers(&self.server_id).await?;
        let new_peers = self.servers_to_peers(&online_servers);

        let mut current = self.peers.write().await;

        // Find peers to add (in new but not in current)
        for (id, peer) in &new_peers {
            if !current.contains_key(id) {
                tracing::info!(
                    peer_hostname = peer.hostname,
                    peer_ip = peer.mesh_ip,
                    "Adding new mesh peer"
                );

                if let Err(e) = mesh_interface.add_peer(
                    &peer.public_key,
                    Some(&format!("{}:{}", peer.public_ip, peer.mesh_port)),
                    &[&format!("{}/32", peer.mesh_ip)],
                    Some(25), // persistent keepalive for NAT traversal
                ) {
                    tracing::error!(
                        peer = peer.hostname,
                        error = %e,
                        "Failed to add mesh peer"
                    );
                    continue;
                }
            }
        }

        // Find peers to remove (in current but not in new)
        let to_remove: Vec<Uuid> = current
            .keys()
            .filter(|id| !new_peers.contains_key(id))
            .cloned()
            .collect();

        for id in to_remove {
            if let Some(peer) = current.get(&id) {
                tracing::info!(
                    peer_hostname = peer.hostname,
                    "Removing offline mesh peer"
                );

                if let Err(e) = mesh_interface.remove_peer(&peer.public_key) {
                    tracing::error!(
                        peer = peer.hostname,
                        error = %e,
                        "Failed to remove mesh peer"
                    );
                }
            }
        }

        *current = new_peers;

        tracing::debug!(peer_count = current.len(), "Mesh peers refreshed");

        Ok(())
    }

    /// Convert relay servers to mesh peer info
    fn servers_to_peers(&self, servers: &[RelayServer]) -> HashMap<Uuid, MeshPeer> {
        servers
            .iter()
            .map(|s| {
                let mesh_ip = mesh_ip_from_uuid(&s.id).to_string();
                (
                    s.id,
                    MeshPeer {
                        server_id: s.id,
                        hostname: s.hostname.clone(),
                        public_ip: s.public_ip.clone(),
                        mesh_port: s.mesh_port,
                        public_key: s.public_key.clone(),
                        mesh_ip,
                    },
                )
            })
            .collect()
    }

    /// Get all current mesh peers
    pub async fn get_peers(&self) -> Vec<MeshPeer> {
        let peers = self.peers.read().await;
        peers.values().cloned().collect()
    }

    /// Get a specific peer by server ID
    pub async fn get_peer(&self, server_id: &Uuid) -> Option<MeshPeer> {
        let peers = self.peers.read().await;
        peers.get(server_id).cloned()
    }

    /// Get peer count
    pub async fn peer_count(&self) -> usize {
        let peers = self.peers.read().await;
        peers.len()
    }
}

/// Background task: periodically refresh mesh peers
pub async fn run_discovery_loop(
    discovery: Arc<MeshDiscovery>,
    supabase: Arc<SupabaseClient>,
    mesh_interface: Arc<WgInterface>,
    interval_secs: u64,
) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));

    loop {
        interval.tick().await;

        if let Err(e) = discovery.refresh_peers(&supabase, &mesh_interface).await {
            tracing::error!(error = %e, "Mesh peer discovery failed");
        }
    }
}
