use crate::state::{RelayServer, ServerLatency};
use std::time::Instant;
use tokio::net::TcpStream;

/// Measure TCP connect latency to a server's WireGuard port.
/// This is a simple approximation of network latency.
async fn measure_latency(ip: &str, port: i32) -> Option<u64> {
    let addr = format!("{ip}:{port}");
    let start = Instant::now();

    match tokio::time::timeout(
        std::time::Duration::from_secs(3),
        TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(_stream)) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Some(elapsed)
        }
        _ => None,
    }
}

/// Ping all servers in parallel and return latency results.
pub async fn ping_all_servers(servers: &[RelayServer]) -> Vec<ServerLatency> {
    let mut handles = Vec::new();

    for server in servers {
        let id = server.id;
        let ip = server.public_ip.clone();
        let port = server.wireguard_port;

        handles.push(tokio::spawn(async move {
            let latency = measure_latency(&ip, port).await;
            latency.map(|ms| ServerLatency {
                server_id: id,
                latency_ms: ms,
            })
        }));
    }

    let mut results = Vec::new();
    for handle in handles {
        if let Ok(Some(result)) = handle.await {
            results.push(result);
        }
    }

    results.sort_by_key(|r| r.latency_ms);
    results
}
