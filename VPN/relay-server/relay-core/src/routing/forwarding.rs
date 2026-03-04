use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::routing::netfilter;
use crate::wg::peer::mesh_ip_from_uuid;

/// Manages per-session forwarding rules
pub struct ForwardingManager {
    /// Our server ID (to determine our role in a path)
    server_id: Uuid,
    /// Active forwarding rules: session_id -> ForwardingRule
    rules: Arc<RwLock<HashMap<Uuid, ForwardingRule>>>,
    /// Next available fwmark (starts at 0x100)
    next_fwmark: Arc<RwLock<u32>>,
}

#[derive(Debug, Clone)]
pub struct ForwardingRule {
    pub session_id: Uuid,
    pub client_ip: String,
    pub next_hop_server_id: Uuid,
    pub next_hop_mesh_ip: String,
    pub fwmark: u32,
    pub table_id: u32,
    pub role: ServerRole,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ServerRole {
    /// First server in the path - receives client traffic
    Entry,
    /// Intermediate relay - forwards between mesh tunnels
    Tunnely,
    /// Last server in the path - exits to internet
    Exit,
}

impl ForwardingManager {
    pub fn new(server_id: Uuid) -> Self {
        Self {
            server_id,
            rules: Arc::new(RwLock::new(HashMap::new())),
            next_fwmark: Arc::new(RwLock::new(0x100)),
        }
    }

    /// Set up forwarding for a new session based on its relay path
    pub async fn setup_session(
        &self,
        session_id: Uuid,
        client_ip: &str,
        relay_path: &[Uuid],
    ) -> Result<ServerRole> {
        if relay_path.is_empty() {
            anyhow::bail!("Tunnely path is empty");
        }

        // Determine our role and next hop
        let our_index = relay_path
            .iter()
            .position(|id| *id == self.server_id)
            .ok_or_else(|| anyhow::anyhow!("This server is not in the relay path"))?;

        let role = if relay_path.len() == 1 {
            // Single-hop path: this server is both entry and exit
            ServerRole::Exit
        } else if our_index == 0 {
            ServerRole::Entry
        } else if our_index == relay_path.len() - 1 {
            ServerRole::Exit
        } else {
            ServerRole::Tunnely
        };

        match role {
            ServerRole::Exit => {
                // Exit server: NAT masquerade handles this (already configured)
                tracing::info!(
                    session = %session_id,
                    client_ip,
                    "Session set up as EXIT (NAT masquerade)"
                );
                Ok(role)
            }
            ServerRole::Entry | ServerRole::Tunnely => {
                // Entry/Tunnely: forward to next hop
                let next_hop_id = *relay_path.get(our_index + 1).ok_or_else(|| {
                    anyhow::anyhow!("No next hop in relay path after index {our_index}")
                })?;
                let next_hop_mesh_ip = mesh_ip_from_uuid(&next_hop_id).to_string();

                let mut fwmark_lock = self.next_fwmark.write().await;
                let fwmark = *fwmark_lock;
                let table_id = fwmark; // Use same value for simplicity
                *fwmark_lock += 1;
                drop(fwmark_lock);

                // Set up Linux policy routing
                netfilter::add_forwarding_rule(client_ip, &next_hop_mesh_ip, fwmark, table_id)?;

                let rule = ForwardingRule {
                    session_id,
                    client_ip: client_ip.to_string(),
                    next_hop_server_id: next_hop_id,
                    next_hop_mesh_ip: next_hop_mesh_ip.clone(),
                    fwmark,
                    table_id,
                    role: role.clone(),
                };

                let mut rules = self.rules.write().await;
                rules.insert(session_id, rule);

                tracing::info!(
                    session = %session_id,
                    client_ip,
                    next_hop = next_hop_mesh_ip,
                    role = ?role,
                    "Forwarding rule installed"
                );

                Ok(role)
            }
        }
    }

    /// Tear down forwarding for a terminated session
    pub async fn teardown_session(&self, session_id: &Uuid) -> Result<()> {
        let mut rules = self.rules.write().await;

        if let Some(rule) = rules.remove(session_id) {
            if rule.role != ServerRole::Exit {
                netfilter::remove_forwarding_rule(rule.fwmark, rule.table_id)?;
            }

            tracing::info!(
                session = %session_id,
                "Forwarding rule removed"
            );
        }

        Ok(())
    }

    /// Get all active forwarding rules
    pub async fn active_rules(&self) -> Vec<ForwardingRule> {
        let rules = self.rules.read().await;
        rules.values().cloned().collect()
    }
}
