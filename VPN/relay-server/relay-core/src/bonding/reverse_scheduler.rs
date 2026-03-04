use relay_common::bonding::{BondingHeader, PacketFlags, BONDING_HEADER_LEN};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::RwLock;

use super::session::BondingSession;

/// Handles server→client reverse distribution of WireGuard packets across
/// the client's bonding channels, wrapping each packet with a BondingHeader.
pub struct ReverseScheduler {
    session: Arc<RwLock<BondingSession>>,
    ext_socket: Arc<UdpSocket>,
    sequence: AtomicU32,
}

impl ReverseScheduler {
    pub fn new(session: Arc<RwLock<BondingSession>>, ext_socket: Arc<UdpSocket>) -> Self {
        Self {
            session,
            ext_socket,
            sequence: AtomicU32::new(0),
        }
    }

    /// Wraps a WireGuard response packet with a bonding header and distributes
    /// it across the client's active channels based on the session's bonding mode.
    pub async fn distribute(&self, wg_data: &[u8]) {
        let addrs: Vec<(u16, SocketAddr)>;
        let mode;

        {
            let mut s = self.session.write().await;
            mode = s.mode;
            let selected = s.select_channels(wg_data.len());
            addrs = selected
                .iter()
                .map(|addr| {
                    let channel = s.channels.values().find(|c| c.peer_addr == *addr);
                    let cid = channel.map(|c| c.id).unwrap_or(0);
                    (cid, *addr)
                })
                .collect();
        }

        if addrs.is_empty() {
            return;
        }

        let seq = self.sequence.fetch_add(1, Ordering::Relaxed);
        let mut first = true;

        for (cid, peer) in &addrs {
            let mut flags = PacketFlags::empty();
            if !first && mode == relay_common::bonding::BondingMode::Redundant {
                flags.insert(PacketFlags::IS_DUPLICATE);
            }
            first = false;

            let header = BondingHeader::new(flags, *cid, seq, wg_data.len() as u16);
            let mut out = vec![0u8; BONDING_HEADER_LEN + wg_data.len()];
            if header.write_to(&mut out).is_err() {
                continue;
            }
            out[BONDING_HEADER_LEN..].copy_from_slice(wg_data);
            let _ = self.ext_socket.send_to(&out, peer).await;
        }
    }

    /// Spawns a background task that continuously reads from the session's WireGuard socket
    /// and distributes responses back to the client.
    pub fn spawn(self: Arc<Self>, wg_socket: Arc<UdpSocket>) {
        tokio::spawn(async move {
            let mut buf = vec![0u8; 65536];
            loop {
                match wg_socket.recv_from(&mut buf).await {
                    Ok((n, _)) => {
                        self.distribute(&buf[..n]).await;
                    }
                    Err(e) => {
                        tracing::error!("Reverse scheduler recv error: {}", e);
                    }
                }
            }
        });
    }
}
