pub mod channel;
pub mod channel_manager;
pub mod config;
pub mod scheduler;
pub mod reorder_buffer;
pub mod link_monitor;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use relay_common::bonding::{BondingHeader, PacketFlags, ControlMessage, BONDING_HEADER_LEN};
use crate::tunnel::bonding::channel_manager::ChannelManager;
use crate::tunnel::bonding::scheduler::PacketScheduler;
use crate::tunnel::bonding::reorder_buffer::ReorderBuffer;
use crate::tunnel::bonding::link_monitor::LinkMonitor;

pub struct BondingLayer {
    pub channel_manager: Arc<RwLock<ChannelManager>>,
    scheduler: Arc<RwLock<PacketScheduler>>,
    link_monitor: Arc<LinkMonitor>,
    session_token: [u8; 16],
    sequence: AtomicU32,
    recv_rx: tokio::sync::Mutex<mpsc::Receiver<(BondingHeader, Vec<u8>)>>,
    reorder_buffer: Arc<tokio::sync::Mutex<ReorderBuffer>>,
    ready_packets: tokio::sync::Mutex<std::collections::VecDeque<Vec<u8>>>,
    mode: Arc<RwLock<relay_common::bonding::BondingMode>>,
}

impl BondingLayer {
    pub async fn new(
        session_token: [u8; 16],
        endpoint: std::net::SocketAddr,
        mode: relay_common::bonding::BondingMode,
    ) -> Self {
        let channel_manager = Arc::new(RwLock::new(ChannelManager::new(endpoint)));
        let scheduler = Arc::new(RwLock::new(PacketScheduler::new()));
        let reorder_buffer = Arc::new(tokio::sync::Mutex::new(ReorderBuffer::new(50)));
        let link_monitor = Arc::new(LinkMonitor::new(channel_manager.clone(), reorder_buffer.clone()));
        let (recv_tx, recv_rx) = mpsc::channel(1024);

        let layer = Self {
            channel_manager,
            scheduler,
            link_monitor,
            session_token,
            sequence: AtomicU32::new(0),
            recv_rx: tokio::sync::Mutex::new(recv_rx),
            reorder_buffer,
            ready_packets: tokio::sync::Mutex::new(std::collections::VecDeque::new()),
            mode: Arc::new(RwLock::new(mode)),
        };

        layer.spawn_background_tasks(recv_tx).await;
        layer.link_monitor.start();
        layer
    }

    async fn spawn_background_tasks(&self, recv_tx: mpsc::Sender<(BondingHeader, Vec<u8>)>) {
        let cm = self.channel_manager.clone();
        let session_token = self.session_token;

        // Interface discovery task
        tokio::spawn(async move {
            loop {
                let addrs = {
                    let manager = cm.read().await;
                    manager.discover_interfaces()
                };

                for iface in addrs {
                    // Just take the first IPv4 addr for now
                    let addr = iface.addr.ip();
                    if addr.is_ipv4() {
                        let mut manager = cm.write().await;
                        // Check if we already have it
                        let exists = manager.get_all_channels().iter().any(|c| c.interface_name == iface.name);
                        if !exists {
                            match manager.create_channel_for_interface(addr, iface.name.clone()).await {
                                Ok(id) => {
                                    tracing::info!("Bonding: created channel {} for interface {} ({})", id, iface.name, addr);
                                    // Spawn receive loop for this channel
                                    if let Some(channel) = manager.get_channel(id) {
                                        Self::spawn_channel_recv(channel.socket.clone(), recv_tx.clone());
                                        
                                        // Send ChannelAnnounce
                                        let info = relay_common::bonding::ChannelInfo {
                                            id,
                                            name: iface.name.clone(),
                                            interface_type: channel.interface_type.clone(),
                                        };
                                        let announce = ControlMessage::ChannelAnnounce {
                                            session_token,
                                            channel: info,
                                            mode: relay_common::bonding::BondingMode::Speed, // The server uses this to configure ReverseScheduler
                                        };
                                        if let Ok(encoded) = bincode::serialize(&announce) {
                                            let header = BondingHeader::new(PacketFlags::IS_CONTROL, id, 0, encoded.len() as u16);
                                            let mut buf = vec![0u8; BONDING_HEADER_LEN + encoded.len()];
                                            header.write_to(&mut buf).unwrap();
                                            buf[BONDING_HEADER_LEN..].copy_from_slice(&encoded);
                                            let _ = channel.socket.send(&buf).await;
                                        }
                                    }
                                }
                                Err(e) => {
                                    tracing::debug!("Could not bind to interface {}: {}", iface.name, e);
                                }
                            }
                        }
                    }
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        });
    }

    fn spawn_channel_recv(socket: Arc<tokio::net::UdpSocket>, tx: mpsc::Sender<(BondingHeader, Vec<u8>)>) {
        tokio::spawn(async move {
            let mut buf = vec![0u8; 65536];
            loop {
                match socket.recv(&mut buf).await {
                    Ok(n) => {
                        if n >= BONDING_HEADER_LEN {
                            match BondingHeader::read_from(&buf[..BONDING_HEADER_LEN]) {
                                Ok(header) => {
                                    let payload_len = header.payload_length as usize;
                                    if n >= BONDING_HEADER_LEN + payload_len {
                                        let payload = buf[BONDING_HEADER_LEN..BONDING_HEADER_LEN + payload_len].to_vec();
                                        if tx.send((header, payload)).await.is_err() {
                                            break;
                                        }
                                    }
                                },
                                Err(_) => {}
                            }
                        }
                    }
                    Err(_) => {
                        // Socket closed or error
                        break;
                    }
                }
            }
        });
    }

    pub async fn send(&self, data: &[u8]) -> std::io::Result<usize> {
        let seq = self.sequence.fetch_add(1, Ordering::Relaxed);
        
        let cm = self.channel_manager.write().await;
        if cm.get_all_channels().is_empty() {
            // Return silently if no channels, we just drop
            return Ok(data.len());
        }
        let channels = cm.get_all_channels();
        
        let mut scheduler = self.scheduler.write().await;
        
        let current_mode = *self.mode.read().await;
        let selected_channels = scheduler.select_channels(&channels, data.len(), current_mode);
        
        if selected_channels.is_empty() {
            return Err(std::io::Error::new(std::io::ErrorKind::NotConnected, "No active bonding channels available"));
        }

        let header = BondingHeader::new(
            PacketFlags::empty(),
            0, // overridden in loop
            seq,
            data.len() as u16,
        );

        let mut buf = vec![0u8; BONDING_HEADER_LEN + data.len()];
        buf[BONDING_HEADER_LEN..].copy_from_slice(data);

        let mut first = true;
        for channel in selected_channels {
            let mut chan_header = header.clone();
            chan_header.channel_id = channel.id;
            if !first && current_mode == relay_common::bonding::BondingMode::Redundant {
                chan_header.flags.insert(PacketFlags::IS_DUPLICATE);
            }
            first = false;
            chan_header.write_to(&mut buf)?;
            let _ = channel.socket.send(&buf).await;
            channel.bytes_sent_window.fetch_add(buf.len() as u64, std::sync::atomic::Ordering::Relaxed);
        }

        Ok(data.len())
    }

    /// Live-switch the bonding mode without reconnecting
    pub async fn set_mode(&self, mode: relay_common::bonding::BondingMode) {
        *self.mode.write().await = mode;
    }

    /// Get the current bonding mode
    #[allow(dead_code)]
    pub async fn current_mode(&self) -> relay_common::bonding::BondingMode {
        *self.mode.read().await
    }

    pub async fn recv(&self, buf: &mut [u8]) -> std::io::Result<usize> {
        let mut ready = self.ready_packets.lock().await;

        if let Some(payload) = ready.pop_front() {
            if payload.len() > buf.len() {
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Buffer too small for payload"));
            }
            buf[..payload.len()].copy_from_slice(&payload);
            return Ok(payload.len());
        }

        let mut rx = self.recv_rx.lock().await;
        let mut rb = self.reorder_buffer.lock().await;

        match tokio::time::timeout(std::time::Duration::from_millis(50), rx.recv()).await {
            Ok(Some((header, payload))) => {
                if header.flags.contains(PacketFlags::IS_CONTROL) {
                    let channel_id = header.channel_id;
                    if let Ok(msg) = bincode::deserialize::<ControlMessage>(&payload) {
                        if let ControlMessage::Pong { client_timestamp_us, .. } = msg {
                            let monitor = self.link_monitor.clone();
                            tokio::spawn(async move {
                                monitor.handle_pong(channel_id, client_timestamp_us).await;
                            });
                        }
                    }
                    return Ok(0);
                }

                let new_ready = rb.insert(header.sequence, payload);
                ready.extend(new_ready);
                
                let expired = rb.flush_expired();
                ready.extend(expired);
            }
            Ok(None) => return Err(std::io::Error::new(std::io::ErrorKind::ConnectionAborted, "Channel closed")),
            Err(_) => {
                // Timeout elapsed, manually flush expired packets
                let expired = rb.flush_expired();
                ready.extend(expired);
            }
        }

        if let Some(first_payload) = ready.pop_front() {
            if first_payload.len() > buf.len() {
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Buffer too small for payload"));
            }
            buf[..first_payload.len()].copy_from_slice(&first_payload);
            Ok(first_payload.len())
        } else {
            Ok(0) // wait for more
        }
    }
}
