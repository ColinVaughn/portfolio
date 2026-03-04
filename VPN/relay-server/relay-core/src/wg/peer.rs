use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Tracks client peers and their assigned tunnel IPs
pub struct PeerManager {
    /// Map of client public key -> assigned tunnel IP
    assignments: Arc<RwLock<HashMap<String, PeerAssignment>>>,
    /// Next available IP octet in the client subnet
    next_ip_offset: Arc<RwLock<u32>>,
    /// Base IP for client subnet (e.g., 10.0.0.0)
    base_ip: Ipv4Addr,
}

#[derive(Debug, Clone)]
pub struct PeerAssignment {
    pub client_public_key: String,
    pub assigned_ip: Ipv4Addr,
    pub session_id: Uuid,
    pub user_id: Uuid,
}

impl PeerManager {
    pub fn new(client_subnet: &str) -> Self {
        // Parse base IP from subnet (e.g., "10.0.0.0/16" -> 10.0.0.0)
        let base_ip: Ipv4Addr = client_subnet
            .split('/')
            .next()
            .unwrap_or("10.0.0.0")
            .parse()
            .unwrap_or(Ipv4Addr::new(10, 0, 0, 0));

        Self {
            assignments: Arc::new(RwLock::new(HashMap::new())),
            // Start from .2 (reserve .1 for the server interface)
            next_ip_offset: Arc::new(RwLock::new(2)),
            base_ip,
        }
    }

    /// Allocate a tunnel IP for a new client.
    /// If the same public key already has an allocation, return its existing IP
    /// (prevents IP pool exhaustion on reconnects).
    pub async fn allocate_ip(
        &self,
        client_public_key: &str,
        session_id: Uuid,
        user_id: Uuid,
    ) -> Ipv4Addr {
        let mut offset = self.next_ip_offset.write().await;
        let mut assignments = self.assignments.write().await;

        // Check for existing allocation (client reconnection)
        if let Some(existing) = assignments.get(client_public_key) {
            tracing::debug!(
                key = &client_public_key[..8],
                ip = %existing.assigned_ip,
                "Reusing existing IP allocation for reconnecting client"
            );
            return existing.assigned_ip;
        }

        let octets = self.base_ip.octets();
        // Distribute across the /16: offset maps to third and fourth octets
        let third = ((*offset >> 8) & 0xFF) as u8;
        let fourth = (*offset & 0xFF) as u8;
        let ip = Ipv4Addr::new(octets[0], octets[1], third, fourth);

        assignments.insert(
            client_public_key.to_string(),
            PeerAssignment {
                client_public_key: client_public_key.to_string(),
                assigned_ip: ip,
                session_id,
                user_id,
            },
        );

        *offset += 1;
        // Skip .0 and .255 in each /24
        if *offset & 0xFF == 0 || *offset & 0xFF == 255 {
            *offset += 1;
        }

        ip
    }

    /// Release a client's tunnel IP
    pub async fn release_ip(&self, client_public_key: &str) -> Option<PeerAssignment> {
        let mut assignments = self.assignments.write().await;
        assignments.remove(client_public_key)
    }

    /// Get assignment for a client
    pub async fn get_assignment(&self, client_public_key: &str) -> Option<PeerAssignment> {
        let assignments = self.assignments.read().await;
        assignments.get(client_public_key).cloned()
    }

    /// Get all current assignments
    pub async fn all_assignments(&self) -> Vec<PeerAssignment> {
        let assignments = self.assignments.read().await;
        assignments.values().cloned().collect()
    }

    /// Current number of connected clients
    pub async fn client_count(&self) -> usize {
        let assignments = self.assignments.read().await;
        assignments.len()
    }
}

/// Compute a deterministic mesh IP for a server based on its UUID
/// Maps UUID to 10.100.x.x
pub fn mesh_ip_from_uuid(server_id: &Uuid) -> Ipv4Addr {
    let bytes = server_id.as_bytes();
    // Use last 2 bytes of UUID for third and fourth octets
    let third = bytes[14];
    let fourth = if bytes[15] == 0 { 1 } else { bytes[15] }; // avoid .0
    Ipv4Addr::new(10, 100, third, fourth)
}
