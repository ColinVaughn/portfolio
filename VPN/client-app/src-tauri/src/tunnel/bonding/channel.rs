use relay_common::bonding::InterfaceType;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use tokio::net::UdpSocket;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChannelState {
    Initializing,
    Active,
    Degraded,
    Failed,
    Disabled,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ChannelQuality {
    pub rtt_us: u32,
    pub rtt_variance_us: u32,
    pub loss_rate: f32,
    pub throughput_bps: u64,
    pub weight: f32,
}

impl Default for ChannelQuality {
    fn default() -> Self {
        Self {
            rtt_us: 100_000,
            rtt_variance_us: 0,
            loss_rate: 0.0,
            throughput_bps: 0,
            weight: 1.0,
        }
    }
}
pub struct Channel {
    pub id: u16,
    pub interface_name: String,
    pub interface_type: InterfaceType,
    pub socket: Arc<UdpSocket>,
    pub state: ChannelState,
    pub quality: ChannelQuality,
    pub last_rx: std::time::Instant,
    pub bytes_sent_window: AtomicU64,
    pub last_throughput_check: std::time::Instant,
    pub unacked_pings: u32,
    pub consecutive_ping_failures: u32,
    pub consecutive_ping_successes: u32,
}

impl Channel {
    pub fn new(
        id: u16,
        interface_name: String,
        interface_type: InterfaceType,
        socket: UdpSocket,
    ) -> Self {
        Self {
            id,
            interface_name,
            interface_type,
            socket: Arc::new(socket),
            state: ChannelState::Initializing,
            quality: ChannelQuality::default(),
            last_rx: std::time::Instant::now(),
            bytes_sent_window: AtomicU64::new(0),
            last_throughput_check: std::time::Instant::now(),
            unacked_pings: 0,
            consecutive_ping_failures: 0,
            consecutive_ping_successes: 0,
        }
    }
}
