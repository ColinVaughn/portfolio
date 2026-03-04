use anyhow::Result;
use relay_common::types::RelayMetric;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::UdpSocket;
use uuid::Uuid;

use crate::health::metrics as prom;
use crate::mesh::discovery::MeshDiscovery;
use crate::supabase::client::SupabaseClient;

const PROBE_RESPONDER_PORT: u16 = 51899;

/// Probe result for a single peer
#[derive(Debug)]
struct ProbeResult {
    rtt_ms: f64,
    jitter_ms: f64,
    packet_loss: f64,
}

/// Background task: periodically probe all mesh peers for latency
pub async fn run_prober_loop(
    server_id: Uuid,
    discovery: Arc<MeshDiscovery>,
    supabase: Arc<SupabaseClient>,
    interval_secs: u64,
    probes_per_cycle: u32,
    probe_timeout_ms: u64,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));

    // Bind UDP socket on ephemeral port for sending probes (responder listens on PROBE_RESPONDER_PORT)
    let socket = match UdpSocket::bind("0.0.0.0:0").await {
        Ok(s) => Arc::new(s),
        Err(e) => {
            tracing::error!(error = %e, "Failed to bind probe socket, prober disabled");
            return;
        }
    };

    loop {
        interval.tick().await;

        let peers = discovery.get_peers().await;
        if peers.is_empty() {
            continue;
        }

        let mut metrics = Vec::new();

        for peer in &peers {
            match probe_peer(
                &socket,
                &peer.mesh_ip,
                probes_per_cycle,
                probe_timeout_ms,
            )
            .await
            {
                Ok(result) => {
                    tracing::debug!(
                        peer = peer.hostname,
                        rtt = result.rtt_ms,
                        jitter = result.jitter_ms,
                        loss = result.packet_loss,
                        "Probe result"
                    );

                    prom::record_probe_rtt(&peer.hostname, result.rtt_ms);

                    metrics.push(RelayMetric {
                        source_id: server_id,
                        target_id: peer.server_id,
                        rtt_ms: result.rtt_ms,
                        jitter_ms: Some(result.jitter_ms),
                        packet_loss: result.packet_loss,
                    });
                }
                Err(e) => {
                    tracing::warn!(
                        peer = peer.hostname,
                        error = %e,
                        "Probe failed"
                    );

                    // Report 100% loss for unreachable peers
                    metrics.push(RelayMetric {
                        source_id: server_id,
                        target_id: peer.server_id,
                        rtt_ms: 999.0,
                        jitter_ms: None,
                        packet_loss: 1.0,
                    });
                }
            }
        }

        // Report all metrics to Supabase
        if let Err(e) = supabase.report_metrics(&metrics).await {
            tracing::error!(error = %e, "Failed to report probe metrics");
        }
    }
}

/// Send probes to a single peer and compute stats
async fn probe_peer(
    socket: &UdpSocket,
    mesh_ip: &str,
    num_probes: u32,
    timeout_ms: u64,
) -> Result<ProbeResult> {
    let target_addr: SocketAddr = format!("{}:{}", mesh_ip, PROBE_RESPONDER_PORT).parse()?;
    let timeout = Duration::from_millis(timeout_ms);

    let mut rtts = Vec::new();
    let mut sent = 0u32;
    let mut received = 0u32;

    for seq in 0..num_probes {
        sent += 1;

        // Build probe packet: [4 bytes sequence] [4 bytes timestamp_ms]
        let now = Instant::now();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u32;

        let mut packet = [0u8; 8];
        packet[..4].copy_from_slice(&seq.to_be_bytes());
        packet[4..8].copy_from_slice(&timestamp.to_be_bytes());

        if let Err(e) = socket.send_to(&packet, target_addr).await {
            tracing::trace!(error = %e, "Probe send failed");
            continue;
        }

        // Wait for echo response
        let mut buf = [0u8; 8];
        match tokio::time::timeout(timeout, socket.recv_from(&mut buf)).await {
            Ok(Ok((8, _))) => {
                let rtt = now.elapsed().as_secs_f64() * 1000.0;
                rtts.push(rtt);
                received += 1;
            }
            Ok(Ok(_)) => {
                tracing::trace!("Invalid probe response size");
            }
            Ok(Err(e)) => {
                tracing::trace!(error = %e, "Probe recv failed");
            }
            Err(_) => {
                tracing::trace!(seq, "Probe timed out");
            }
        }
    }

    if rtts.is_empty() {
        return Ok(ProbeResult {
            rtt_ms: 999.0,
            jitter_ms: 0.0,
            packet_loss: 1.0,
        });
    }

    // Sort and discard highest RTT (remove outlier)
    rtts.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    if rtts.len() > 2 {
        rtts.pop(); // Remove highest
    }

    let avg_rtt = rtts.iter().sum::<f64>() / rtts.len() as f64;
    let jitter = if rtts.len() > 1 {
        let mean = avg_rtt;
        let variance = rtts.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / rtts.len() as f64;
        variance.sqrt()
    } else {
        0.0
    };
    let loss = (sent - received) as f64 / sent as f64;

    Ok(ProbeResult {
        rtt_ms: avg_rtt,
        jitter_ms: jitter,
        packet_loss: loss,
    })
}

/// Background task: listen for incoming probe packets and echo them back
pub async fn run_probe_responder() {
    let socket = match UdpSocket::bind(format!("0.0.0.0:{}", PROBE_RESPONDER_PORT)).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, "Failed to bind probe responder socket");
            return;
        }
    };

    tracing::info!(port = PROBE_RESPONDER_PORT, "Probe responder listening");

    let mut buf = [0u8; 8];
    loop {
        match socket.recv_from(&mut buf).await {
            Ok((8, src)) => {
                // Echo the probe back immediately
                if let Err(e) = socket.send_to(&buf, src).await {
                    tracing::trace!(error = %e, "Probe echo send failed");
                }
            }
            Ok((n, _)) => {
                tracing::trace!(bytes = n, "Invalid probe packet size");
            }
            Err(e) => {
                tracing::warn!(error = %e, "Probe responder recv error");
            }
        }
    }
}
