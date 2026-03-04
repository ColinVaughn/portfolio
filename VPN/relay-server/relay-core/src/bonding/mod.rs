pub mod reorder_buffer;
pub mod reverse_scheduler;
pub mod session;

use std::collections::HashMap;
use std::net::SocketAddr;

use relay_common::bonding::{BondingHeader, BondingMode, PacketFlags, BONDING_HEADER_LEN};
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::RwLock;

/// Manages multiple client bonding sessions
pub struct SessionManager {
    // Maps 16-byte session token -> BondingSession
    sessions: RwLock<HashMap<[u8; 16], Arc<RwLock<session::BondingSession>>>>,
    // Fast-path mapping: Peer IP -> Session token
    peer_map: RwLock<HashMap<SocketAddr, [u8; 16]>>,
    ext_socket: Arc<UdpSocket>,
    wg_addr: SocketAddr,
}

impl SessionManager {
    pub fn new(ext_socket: Arc<UdpSocket>, wg_port: u16) -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            peer_map: RwLock::new(HashMap::new()),
            ext_socket,
            wg_addr: format!("127.0.0.1:{}", wg_port).parse().unwrap(),
        }
    }

    pub async fn add_session(&self, token: [u8; 16], mode: BondingMode) {
        let wg_socket = UdpSocket::bind("127.0.0.1:0")
            .await
            .expect("Failed to bind wg socket");
        let session = Arc::new(RwLock::new(session::BondingSession::new(
            token, mode, wg_socket,
        )));
        self.sessions.write().await.insert(token, session.clone());

        // Spawn reverse distribution using ReverseScheduler
        let rx_local = session.read().await.wg_socket.clone();
        let rev_sched = Arc::new(reverse_scheduler::ReverseScheduler::new(
            session.clone(),
            self.ext_socket.clone(),
        ));
        rev_sched.spawn(rx_local);

        // Spawn flush task
        let tx_flush = session.read().await.wg_socket.clone();
        let session_flush = session.clone();
        let wg_addr_flush = self.wg_addr;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(10));
            loop {
                interval.tick().await;
                let flushed = session_flush.write().await.reorder_buffer.flush_expired();
                for packet in flushed {
                    if let Err(e) = tx_flush.send_to(&packet, &wg_addr_flush).await {
                        tracing::warn!("Failed to forward expired packet to local wg: {}", e);
                    }
                }
            }
        });

        tracing::info!("Registered new bonding session");
    }

    pub async fn get_session_by_peer(
        &self,
        peer: &SocketAddr,
    ) -> Option<Arc<RwLock<session::BondingSession>>> {
        let token = {
            let map = self.peer_map.read().await;
            map.get(peer).copied()
        };
        if let Some(token) = token {
            let sessions = self.sessions.read().await;
            sessions.get(&token).cloned()
        } else {
            None
        }
    }

    pub async fn map_peer_to_session(&self, peer: SocketAddr, token: [u8; 16]) -> bool {
        let sessions = self.sessions.read().await;
        if sessions.contains_key(&token) {
            let mut map = self.peer_map.write().await;
            map.insert(peer, token);
            true
        } else {
            false
        }
    }

    pub async fn get_all_sessions(&self) -> Vec<Arc<RwLock<session::BondingSession>>> {
        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }
}

/// Receives bonded packets from the external socket, reorders them,
/// and forwards the reassembled payloads to the local WireGuard port.
pub struct BondingAggregator {}

impl BondingAggregator {
    pub async fn run(
        ext_socket: Arc<UdpSocket>,
        wg_port: u16,
        session_manager: Arc<SessionManager>,
    ) -> anyhow::Result<()> {
        let wg_addr: SocketAddr = format!("127.0.0.1:{}", wg_port).parse()?;

        // Task 1: External -> WG Local
        let rx_ext = ext_socket.clone();
        let sm_rx = session_manager.clone();

        // Handle in the same task
        let mut buf = vec![0u8; 65536];
        loop {
            match rx_ext.recv_from(&mut buf).await {
                Ok((n, peer)) => {
                    if n < BONDING_HEADER_LEN {
                        continue;
                    }
                    match BondingHeader::read_from(&buf[..BONDING_HEADER_LEN]) {
                        Ok(header) => {
                            let payload_len = header.payload_length as usize;
                            if n >= BONDING_HEADER_LEN + payload_len {
                                if header.flags.contains(PacketFlags::IS_CONTROL) {
                                    use relay_common::bonding::ControlMessage;
                                    if let Ok(msg) = bincode::deserialize::<ControlMessage>(
                                        &buf[BONDING_HEADER_LEN..BONDING_HEADER_LEN + payload_len],
                                    ) {
                                        match msg {
                                            ControlMessage::ChannelAnnounce {
                                                session_token,
                                                channel: _,
                                                mode: _,
                                            } => {
                                                if sm_rx
                                                    .map_peer_to_session(peer, session_token)
                                                    .await
                                                {
                                                    tracing::debug!(
                                                        "Mapped peer {} to session",
                                                        peer
                                                    );
                                                } else {
                                                    tracing::warn!(
                                                        "Unknown session token from peer {}",
                                                        peer
                                                    );
                                                }
                                            }
                                            ControlMessage::Ping {
                                                channel_id,
                                                timestamp_us,
                                            } => {
                                                let now_us = std::time::SystemTime::now()
                                                    .duration_since(std::time::UNIX_EPOCH)
                                                    .unwrap_or_default()
                                                    .as_micros()
                                                    as u32;
                                                let pong = ControlMessage::Pong {
                                                    channel_id,
                                                    server_timestamp_us: now_us,
                                                    client_timestamp_us: timestamp_us,
                                                };
                                                if let Ok(encoded) = bincode::serialize(&pong) {
                                                    let pong_header = BondingHeader::new(
                                                        PacketFlags::IS_CONTROL,
                                                        channel_id,
                                                        0,
                                                        encoded.len() as u16,
                                                    );
                                                    let mut out = vec![
                                                        0u8;
                                                        BONDING_HEADER_LEN
                                                            + encoded.len()
                                                    ];
                                                    pong_header.write_to(&mut out).unwrap();
                                                    out[BONDING_HEADER_LEN..]
                                                        .copy_from_slice(&encoded);
                                                    let _ = rx_ext.send_to(&out, peer).await;
                                                }
                                            }
                                            _ => {}
                                        }
                                    }
                                } else {
                                    if let Some(session) = sm_rx.get_session_by_peer(&peer).await {
                                        session
                                            .write()
                                            .await
                                            .update_channel(header.channel_id, peer);

                                        // Reorder Buffer Integration
                                        let payload = buf
                                            [BONDING_HEADER_LEN..BONDING_HEADER_LEN + payload_len]
                                            .to_vec();
                                        let ready_packets = session
                                            .write()
                                            .await
                                            .reorder_buffer
                                            .insert(header.sequence, payload);

                                        let wg_socket = session.read().await.wg_socket.clone();
                                        for packet in ready_packets {
                                            if let Err(e) =
                                                wg_socket.send_to(&packet, &wg_addr).await
                                            {
                                                tracing::warn!(
                                                    "Failed to forward to local wg: {}",
                                                    e
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(_) => {
                            // Invalid bonding packet, ignore
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Bonding socket recv error: {}", e);
                }
            }
        }
    }
}
