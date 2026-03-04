use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use relay_common::bonding::{BondingHeader, PacketFlags, ControlMessage, BONDING_HEADER_LEN};
use crate::tunnel::bonding::channel_manager::ChannelManager;

pub struct LinkMonitor {
    channel_manager: Arc<RwLock<ChannelManager>>,
    reorder_buffer: Arc<tokio::sync::Mutex<crate::tunnel::bonding::reorder_buffer::ReorderBuffer>>,
}

impl LinkMonitor {
    pub fn new(
        channel_manager: Arc<RwLock<ChannelManager>>,
        reorder_buffer: Arc<tokio::sync::Mutex<crate::tunnel::bonding::reorder_buffer::ReorderBuffer>>,
    ) -> Self {
        Self { channel_manager, reorder_buffer }
    }

    pub fn start(&self) {
        let cm = self.channel_manager.clone();
        tokio::spawn(async move {
            loop {
                // Send Ping on all active/initializing channels every 500ms
                {
                    let mut manager = cm.write().await;
                    let channels = manager.get_all_channels_mut();
                    
                    let now_us = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_micros() as u32;

                    for channel in channels {
                        let now = Instant::now();
                        
                        // Throughput calculation
                        let tp_elapsed = now.duration_since(channel.last_throughput_check).as_secs_f64();
                        if tp_elapsed >= 0.5 {
                            let bytes = channel.bytes_sent_window.swap(0, std::sync::atomic::Ordering::Relaxed);
                            channel.quality.throughput_bps = (bytes as f64 * 8.0 / tp_elapsed) as u64;
                            channel.last_throughput_check = now;
                        }

                        // Ping tracking & Loss rate
                        channel.unacked_pings += 1;
                        if channel.unacked_pings > 1 {
                            channel.quality.loss_rate = (channel.quality.loss_rate * 0.8) + 0.2;
                        }

                        if channel.unacked_pings >= 2 {
                            channel.consecutive_ping_failures += 1;
                            channel.consecutive_ping_successes = 0;
                            
                            if channel.consecutive_ping_failures >= 5 {
                                if channel.state != crate::tunnel::bonding::channel::ChannelState::Failed {
                                    tracing::warn!("Bonding: Channel {} ({}) marked FAILED", channel.id, channel.interface_name);
                                    channel.state = crate::tunnel::bonding::channel::ChannelState::Failed;
                                }
                            } else if channel.consecutive_ping_failures >= 2 {
                                if channel.state == crate::tunnel::bonding::channel::ChannelState::Active {
                                    tracing::warn!("Bonding: Channel {} ({}) marked DEGRADED", channel.id, channel.interface_name);
                                    channel.state = crate::tunnel::bonding::channel::ChannelState::Degraded;
                                }
                            }
                        }

                        if channel.state == crate::tunnel::bonding::channel::ChannelState::Failed {
                            // Only ping failed channels every 2 seconds to check for recovery
                            let now_secs = now_us / 1_000_000;
                            if now_secs % 2 != 0 {
                                continue;
                            }
                        }

                        let ping = ControlMessage::Ping {
                            channel_id: channel.id,
                            timestamp_us: now_us,
                        };

                        if let Ok(encoded) = bincode::serialize(&ping) {
                            let header = BondingHeader::new(PacketFlags::IS_CONTROL, channel.id, 0, encoded.len() as u16);
                            let mut buf = vec![0u8; BONDING_HEADER_LEN + encoded.len()];
                            header.write_to(&mut buf).unwrap();
                            buf[BONDING_HEADER_LEN..].copy_from_slice(&encoded);
                            let _ = channel.socket.send(&buf).await;
                        }
                    }
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        });
    }

    pub async fn handle_pong(&self, channel_id: u16, client_timestamp_us: u32) {
        let now_us = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_micros() as u32;
            
        let rtt_us = now_us.saturating_sub(client_timestamp_us);
        
        // Update EWMA
        let mut manager = self.channel_manager.write().await;
        if let Some(channel) = manager.get_channel_mut(channel_id) {
            let qual = &mut channel.quality;
            if qual.rtt_us == 0 {
                qual.rtt_us = rtt_us;
                qual.rtt_variance_us = rtt_us / 2;
            } else {
                // EWMA alpha=0.125 for RTT, beta=0.25 for variance
                let diff = if rtt_us > qual.rtt_us { rtt_us - qual.rtt_us } else { qual.rtt_us - rtt_us };
                qual.rtt_variance_us = (qual.rtt_variance_us * 3 + diff) / 4;
                qual.rtt_us = (qual.rtt_us * 7 + rtt_us) / 8;
            }
            
            // Recompute weight
            let tp = (qual.throughput_bps as f32).max(10_000.0);
            qual.weight = tp * (1.0 - qual.loss_rate) / (1.0 + (qual.rtt_us as f32 / 100_000.0));
            
            channel.unacked_pings = 0;
            channel.quality.loss_rate *= 0.8;
            
            channel.consecutive_ping_successes += 1;
            channel.consecutive_ping_failures = 0;
            
            if channel.consecutive_ping_successes >= 3 && channel.state != crate::tunnel::bonding::channel::ChannelState::Active {
                tracing::info!("Bonding: Channel {} ({}) RECOVERED to Active", channel.id, channel.interface_name);
                channel.state = crate::tunnel::bonding::channel::ChannelState::Active;
            }
            
            if channel.state == crate::tunnel::bonding::channel::ChannelState::Initializing {
                channel.state = crate::tunnel::bonding::channel::ChannelState::Active;
            }
            
            channel.last_rx = Instant::now();
        }
        
        // Dynamic reorder timeout: (max_rtt - min_rtt) / 2 + 5ms, capped at 100ms
        let all_channels = manager.get_all_channels();
        let active_rtts: Vec<u32> = all_channels.iter()
            .filter(|c| c.state == crate::tunnel::bonding::channel::ChannelState::Active)
            .map(|c| c.quality.rtt_us)
            .collect();
        if active_rtts.len() >= 2 {
            let max_rtt = *active_rtts.iter().max().unwrap();
            let min_rtt = *active_rtts.iter().min().unwrap();
            let dynamic_ms = ((max_rtt - min_rtt) / 2000 + 5).min(100) as u64; // /2000 = /2 then /1000 for us->ms
            let mut rb = self.reorder_buffer.lock().await;
            rb.set_timeout(dynamic_ms);
        }
    }
}
