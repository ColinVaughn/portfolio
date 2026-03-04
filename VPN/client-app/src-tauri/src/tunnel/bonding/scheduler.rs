use crate::tunnel::bonding::channel::{Channel, ChannelState};

use relay_common::bonding::BondingMode;

use std::collections::HashMap;

pub struct PacketScheduler {
    current_index: usize,
    deficits: HashMap<u16, f32>,
}

impl PacketScheduler {
    pub fn new() -> Self {
        Self {
            current_index: 0,
            deficits: HashMap::new(),
        }
    }

    /// Select channels for transmission based on mode
    pub fn select_channels<'a>(
        &mut self,
        channels: &'a [&'a Channel],
        packet_size: usize,
        mode: BondingMode,
    ) -> Vec<&'a Channel> {
        // Filter out degraded/failed/disabled channels
        let active_channels: Vec<&&Channel> = channels
            .iter()
            .filter(|c| c.state == ChannelState::Active || c.state == ChannelState::Initializing)
            .collect();

        if active_channels.is_empty() {
            return vec![];
        }

        match mode {
            BondingMode::Redundant => active_channels.into_iter().copied().collect(),
            BondingMode::Speed => {
                // Determine weights
                let mut weights = Vec::new();
                for c in &active_channels {
                    let tp = (c.quality.throughput_bps as f32).max(10_000.0);
                    let weight = tp * (1.0 - c.quality.loss_rate)
                        / (1.0 + (c.quality.rtt_us as f32 / 100_000.0));
                    weights.push((c.id, weight));
                }

                // If it's a new channel, initialize deficit
                for (id, _) in &weights {
                    self.deficits.entry(*id).or_insert(0.0);
                }

                // Classic DWRR iteration
                let mut selected = None;
                for _ in 0..(active_channels.len() * 2) {
                    // safety bound
                    self.current_index = (self.current_index + 1) % active_channels.len();
                    let channel = active_channels[self.current_index];
                    let weight = weights[self.current_index].1;

                    let def = self.deficits.get_mut(&channel.id).unwrap();
                    *def += weight;
                    // cost in bits
                    let cost = (packet_size * 8) as f32;
                    if *def >= cost {
                        *def -= cost;
                        selected = Some(*channel);
                        break;
                    }
                }

                if let Some(c) = selected {
                    vec![c]
                } else {
                    // Fallback to basic RR
                    self.current_index = (self.current_index + 1) % active_channels.len();
                    vec![*active_channels[self.current_index]]
                }
            }
            BondingMode::Quality => {
                const SMALL_PACKET_THRESHOLD: usize = 200;
                if packet_size < SMALL_PACKET_THRESHOLD {
                    // Send small packets over lowest latency channel
                    let best = active_channels
                        .iter()
                        .min_by_key(|c| c.quality.rtt_us)
                        .unwrap_or(&&active_channels[0]);
                    vec![**best]
                } else {
                    // Large packets use same DWRR as Speed mode
                    let mut weights = Vec::new();
                    for c in &active_channels {
                        let tp = (c.quality.throughput_bps as f32).max(10_000.0);
                        let weight = tp * (1.0 - c.quality.loss_rate)
                            / (1.0 + (c.quality.rtt_us as f32 / 100_000.0));
                        weights.push((c.id, weight));
                    }
                    for (id, _) in &weights {
                        self.deficits.entry(*id).or_insert(0.0);
                    }
                    let mut selected = None;
                    for _ in 0..(active_channels.len() * 2) {
                        self.current_index = (self.current_index + 1) % active_channels.len();
                        let channel = active_channels[self.current_index];
                        let weight = weights[self.current_index].1;
                        let def = self.deficits.get_mut(&channel.id).unwrap();
                        *def += weight;
                        let cost = (packet_size * 8) as f32;
                        if *def >= cost {
                            *def -= cost;
                            selected = Some(*channel);
                            break;
                        }
                    }
                    if let Some(c) = selected {
                        vec![c]
                    } else {
                        self.current_index = (self.current_index + 1) % active_channels.len();
                        vec![*active_channels[self.current_index]]
                    }
                }
            }
        }
    }
}
