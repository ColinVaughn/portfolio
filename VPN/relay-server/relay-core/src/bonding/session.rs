use crate::bonding::reorder_buffer::ReorderBuffer;
use relay_common::bonding::BondingMode;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use tokio::net::UdpSocket;

pub struct ServerChannel {
    pub id: u16,
    pub peer_addr: SocketAddr,
    pub last_rx: Instant,
}

pub struct BondingSession {
    pub session_token: [u8; 16],
    pub mode: BondingMode,
    pub channels: HashMap<u16, ServerChannel>,
    pub current_index: usize,
    pub reorder_buffer: ReorderBuffer,
    pub wg_socket: Arc<UdpSocket>,
}

impl BondingSession {
    pub fn new(session_token: [u8; 16], mode: BondingMode, wg_socket: UdpSocket) -> Self {
        Self {
            session_token,
            mode,
            channels: HashMap::new(),
            current_index: 0,
            reorder_buffer: ReorderBuffer::new(50), // 50ms wait
            wg_socket: Arc::new(wg_socket),
        }
    }

    pub fn update_channel(&mut self, channel_id: u16, peer_addr: SocketAddr) {
        if let Some(chan) = self.channels.get_mut(&channel_id) {
            chan.peer_addr = peer_addr;
            chan.last_rx = Instant::now();
        } else {
            self.channels.insert(
                channel_id,
                ServerChannel {
                    id: channel_id,
                    peer_addr,
                    last_rx: Instant::now(),
                },
            );
        }
    }

    pub fn select_channel(&mut self, _packet_size: usize) -> Option<SocketAddr> {
        let now = Instant::now();
        // Filter out channels that haven't been heard from in 5 seconds
        let active: Vec<_> = self
            .channels
            .values()
            .filter(|c| now.duration_since(c.last_rx).as_secs() < 5)
            .collect();

        if active.is_empty() {
            return None;
        }

        match self.mode {
            BondingMode::Speed => {
                self.current_index = (self.current_index + 1) % active.len();
                Some(active[self.current_index].peer_addr)
            }
            BondingMode::Redundant => {
                // Redundant mode returns multiple, but for simple reverse distribution,
                // returning the first or just duplicating requires returning Vec<SocketAddr>.
                // For now just return the first one as a fallback or change signature to return Vec.
                Some(active[0].peer_addr)
            }
            BondingMode::Quality => {
                // Not enough stats on server, fallback to round robin
                self.current_index = (self.current_index + 1) % active.len();
                Some(active[self.current_index].peer_addr)
            }
        }
    }

    pub fn select_channels(&mut self, packet_size: usize) -> Vec<SocketAddr> {
        let now = Instant::now();
        let active: Vec<_> = self
            .channels
            .values()
            .filter(|c| now.duration_since(c.last_rx).as_secs() < 5)
            .collect();

        if active.is_empty() {
            return vec![];
        }

        match self.mode {
            BondingMode::Redundant => active.iter().map(|c| c.peer_addr).collect(),
            _ => {
                if let Some(addr) = self.select_channel(packet_size) {
                    vec![addr]
                } else {
                    vec![]
                }
            }
        }
    }
}
