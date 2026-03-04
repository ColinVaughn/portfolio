use anyhow::Result;
use bytes::Bytes;
use quinn::{Connection, Endpoint};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::broadcast;

use crate::tls::TlsConfig;

/// QUIC tunnel server that wraps WireGuard UDP traffic
///
/// Architecture:
/// ```text
/// Client ---[QUIC datagram on :443]---> QuicTunnel
///                                          |
///                                     [UDP forward]
///                                          |
///                                          v
///                                   WireGuard (localhost:51820)
/// ```
///
/// Incoming QUIC datagrams are unwrapped and forwarded as raw UDP
/// to the local WireGuard port. Return WireGuard packets are wrapped
/// back into QUIC datagrams to the client.
pub struct QuicTunnel {
    endpoint: Endpoint,
    wg_target: SocketAddr,
    shutdown_tx: broadcast::Sender<()>,
}

impl QuicTunnel {
    /// Create and start the QUIC tunnel server
    pub async fn bind(
        listen_addr: SocketAddr,
        tls_config: TlsConfig,
        wg_target_port: u16,
    ) -> Result<Self> {
        let server_config = tls_config.into_quinn_server_config()?;

        let endpoint = Endpoint::server(server_config, listen_addr)
            .map_err(|e| anyhow::anyhow!("Failed to bind QUIC endpoint on {listen_addr}: {e}"))?;

        let wg_target: SocketAddr = format!("127.0.0.1:{}", wg_target_port).parse()?;
        let (shutdown_tx, _) = broadcast::channel(1);

        tracing::info!(
            listen = %listen_addr,
            wg_forward = %wg_target,
            "QUIC tunnel server bound"
        );

        Ok(Self {
            endpoint,
            wg_target,
            shutdown_tx,
        })
    }

    /// Run the QUIC tunnel server, accepting connections
    pub async fn run(&self) -> Result<()> {
        tracing::info!(
            addr = %self.endpoint.local_addr()?,
            "QUIC tunnel accepting connections"
        );

        while let Some(incoming) = self.endpoint.accept().await {
            let wg_target = self.wg_target;
            let mut shutdown_rx = self.shutdown_tx.subscribe();

            tokio::spawn(async move {
                let remote = incoming.remote_address();

                match incoming.await {
                    Ok(conn) => {
                        tracing::info!(
                            remote = %remote,
                            "QUIC connection established"
                        );

                        tokio::select! {
                            result = handle_connection(conn, wg_target) => {
                                if let Err(e) = result {
                                    tracing::debug!(
                                        remote = %remote,
                                        error = %e,
                                        "QUIC connection ended"
                                    );
                                }
                            }
                            _ = shutdown_rx.recv() => {
                                tracing::debug!(remote = %remote, "Connection shutdown");
                            }
                        }
                    }
                    Err(e) => {
                        tracing::debug!(
                            remote = %remote,
                            error = %e,
                            "QUIC connection failed"
                        );
                    }
                }
            });
        }

        Ok(())
    }

    /// Gracefully shut down the QUIC tunnel
    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(());
        self.endpoint
            .close(quinn::VarInt::from_u32(0), b"server shutting down");
        tracing::info!("QUIC tunnel shutdown initiated");
    }

    /// Wait for all connections to drain
    pub async fn wait_idle(&self) {
        self.endpoint.wait_idle().await;
        tracing::info!("QUIC tunnel fully drained");
    }

    /// Get the number of active connections (approximate)
    pub fn local_addr(&self) -> Result<SocketAddr> {
        self.endpoint.local_addr().map_err(Into::into)
    }
}

/// Handle a single QUIC connection - bidirectional datagram forwarding
async fn handle_connection(conn: Connection, wg_target: SocketAddr) -> Result<()> {
    // Create a UDP socket to forward to the local WireGuard interface
    let wg_socket = UdpSocket::bind("0.0.0.0:0").await?;
    wg_socket.connect(wg_target).await?;

    let wg_socket = Arc::new(wg_socket);
    let conn = Arc::new(conn);

    // Task 1: QUIC datagrams -> WireGuard UDP
    let conn_rx = conn.clone();
    let wg_tx = wg_socket.clone();
    let quic_to_wg = tokio::spawn(async move {
        loop {
            match conn_rx.read_datagram().await {
                Ok(datagram) => {
                    if let Err(e) = wg_tx.send(&datagram).await {
                        tracing::trace!(error = %e, "Failed to forward to WireGuard");
                        break;
                    }
                }
                Err(e) => {
                    tracing::debug!(error = %e, "QUIC datagram read ended");
                    break;
                }
            }
        }
    });

    // Task 2: WireGuard UDP -> QUIC datagrams
    let conn_tx = conn.clone();
    let wg_rx = wg_socket.clone();
    let wg_to_quic = tokio::spawn(async move {
        let mut buf = vec![0u8; 65535];
        loop {
            match wg_rx.recv(&mut buf).await {
                Ok(n) => {
                    let data = Bytes::copy_from_slice(&buf[..n]);
                    if let Err(e) = conn_tx.send_datagram(data) {
                        tracing::debug!(error = %e, "QUIC datagram send failed");
                        break;
                    }
                }
                Err(e) => {
                    tracing::debug!(error = %e, "WireGuard recv ended");
                    break;
                }
            }
        }
    });

    // Wait for either direction to end
    tokio::select! {
        _ = quic_to_wg => {}
        _ = wg_to_quic => {}
    }

    // Connection is done
    conn.close(quinn::VarInt::from_u32(0), b"done");

    Ok(())
}
