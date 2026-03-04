#![allow(dead_code)]

mod api;
mod bonding;
mod config;
mod dns;
mod health;
mod mesh;
mod routing;
mod supabase;
mod wg;

use anyhow::Result;
use relay_common::types::{ServerRegistration, ServerStatus};
use std::path::Path;
use std::sync::Arc;

use crate::api::server::{start_api_server, AppState};
use crate::config::RelayConfig;
use crate::health::metrics as prom;
use crate::mesh::discovery::{run_discovery_loop, MeshDiscovery};
use crate::mesh::prober::{run_probe_responder, run_prober_loop};
use crate::mesh::tunnel;
use crate::routing::forwarding::ForwardingManager;
use crate::routing::netfilter;
use crate::supabase::client::SupabaseClient;
use crate::wg::keys::WgKeyPair;
use crate::wg::peer::PeerManager;

#[tokio::main]
async fn main() -> Result<()> {
    // Install rustls crypto provider before any TLS operations (required by rustls 0.23+)
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls CryptoProvider");

    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "relay_core=info,relay_quic=info".into()),
        )
        .init();

    tracing::info!(
        "VPN Relay Server v{} starting...",
        env!("CARGO_PKG_VERSION")
    );

    // Load configuration
    let config = RelayConfig::from_env();
    tracing::info!(
        hostname = config.server.hostname,
        region = config.server.region,
        city = config.server.city,
        "Configuration loaded"
    );

    // Spin up Prometheus metrics on the port right above the API
    let metrics_port = config.api.port + 1;
    if let Err(e) = prom::init_prometheus(&config.api.bind_address, metrics_port) {
        tracing::warn!(error = %e, "Prometheus metrics disabled");
    }

    // Load or generate WireGuard keypairs
    let key_dir = Path::new(&config.wireguard.key_dir);
    let client_keypair = WgKeyPair::load_or_generate(key_dir, "client")?;
    let mesh_keypair = WgKeyPair::load_or_generate(key_dir, "mesh")?;

    tracing::info!(
        client_pubkey = client_keypair.public_key_base64(),
        mesh_pubkey = mesh_keypair.public_key_base64(),
        "WireGuard keypairs ready"
    );

    // Initialize Supabase client
    let supabase = Arc::new(SupabaseClient::new(
        &config.supabase.url,
        &config.supabase.service_role_key,
    ));

    // Determine capabilities based on config
    let mut capabilities = vec!["wireguard", "mesh"];
    if config.quic.enabled {
        capabilities.push("quic");
    }
    if config.dns_filter.enabled {
        capabilities.push("dns_filter");
    }

    // Register with Supabase
    let registration = ServerRegistration {
        hostname: config.server.hostname.clone(),
        region: config.server.region.clone(),
        city: config.server.city.clone(),
        country_code: config.server.country_code.clone(),
        public_ip: config.server.public_ip.clone(),
        wireguard_port: config.wireguard.client_port,
        mesh_port: config.wireguard.mesh_port,
        quic_port: config.quic.port,
        api_port: config.api.port,
        public_key: client_keypair.public_key_base64(),
        latitude: config.server.latitude,
        longitude: config.server.longitude,
        max_clients: config.server.max_clients,
        status: ServerStatus::Initializing,
        version: config.server.version.clone(),
        capabilities: serde_json::json!(capabilities),
    };

    let server_record = supabase.register_server(&registration).await?;
    let server_id = server_record.id;
    tracing::info!(server_id = %server_id, "Registered with Supabase");

    // Create WireGuard interfaces
    let client_interface = Arc::new(tunnel::create_client_interface(&client_keypair, &config)?);
    let mesh_interface = Arc::new(tunnel::create_mesh_interface(
        &server_id,
        &mesh_keypair,
        &config,
    )?);

    // Set up NAT masquerading
    let wan_interface = detect_wan_interface().unwrap_or_else(|| "eth0".to_string());
    if let Err(e) = netfilter::setup_nat_masquerade(&wan_interface) {
        tracing::warn!(error = %e, "Failed to set up NAT (may need root)");
    }

    // Initialize managers
    let peer_manager = Arc::new(PeerManager::new(&config.wireguard.client_subnet));
    let discovery = Arc::new(MeshDiscovery::new(server_id));
    let forwarding = Arc::new(ForwardingManager::new(server_id));

    // Initialize bonding SessionManager
    let ext_socket = if config.bonding.enabled {
        let socket =
            tokio::net::UdpSocket::bind(format!("0.0.0.0:{}", config.bonding.port)).await?;
        Arc::new(socket)
    } else {
        let socket = tokio::net::UdpSocket::bind("127.0.0.1:0").await?;
        Arc::new(socket)
    };
    let bonding_sessions = Arc::new(bonding::SessionManager::new(
        ext_socket.clone(),
        config.wireguard.client_port,
    ));

    // Initial peer discovery
    if let Err(e) = discovery.refresh_peers(&supabase, &mesh_interface).await {
        tracing::warn!(error = %e, "Initial peer discovery failed (will retry)");
    }

    // Update status to online
    supabase
        .update_status(&server_id, &ServerStatus::Online)
        .await?;
    prom::set_server_online(true);
    tracing::info!("Server status: ONLINE");

    // Shutdown signal (broadcast to all services on ctrl-c)
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

    // Build shared app state
    let app_state = Arc::new(AppState {
        server_id,
        config: config.clone(),
        client_keypair,
        client_interface,
        peer_manager: peer_manager.clone(),
        supabase: supabase.clone(),
        discovery: discovery.clone(),
        forwarding,
        bonding_sessions: bonding_sessions.clone(),
    });

    // ========== Spawn background tasks ==========

    let heartbeat_handle = tokio::spawn(health::heartbeat::run_heartbeat_loop(
        server_id,
        supabase.clone(),
        peer_manager.clone(),
        config.health.heartbeat_interval_secs,
    ));

    let discovery_handle = tokio::spawn(run_discovery_loop(
        discovery.clone(),
        supabase.clone(),
        mesh_interface.clone(),
        config.mesh.discovery_interval_secs,
    ));

    let prober_handle = tokio::spawn(run_prober_loop(
        server_id,
        discovery.clone(),
        supabase.clone(),
        config.mesh.probe_interval_secs,
        config.mesh.probes_per_cycle,
        config.mesh.probe_timeout_ms,
    ));

    let responder_handle = tokio::spawn(run_probe_responder());

    let api_handle = tokio::spawn(start_api_server(app_state, shutdown_rx.clone()));

    // QUIC obfuscation tunnel (wraps WG traffic as HTTPS)
    let quic_tunnel = if config.quic.enabled {
        tracing::info!("QUIC obfuscation layer enabled");

        let tls_config = if config.quic.auto_generate_cert {
            relay_quic::tls::TlsConfig::load_or_generate(
                Path::new(&config.quic.cert_path),
                Path::new(&config.quic.key_path),
                &config.server.hostname,
            )?
        } else {
            relay_quic::tls::TlsConfig::from_pem_files(
                Path::new(&config.quic.cert_path),
                Path::new(&config.quic.key_path),
            )?
        };

        let listen_addr = format!("0.0.0.0:{}", config.quic.port).parse()?;
        let tunnel = relay_quic::tunnel::QuicTunnel::bind(
            listen_addr,
            tls_config,
            config.wireguard.client_port,
        )
        .await?;

        let tunnel = Arc::new(tunnel);
        let tunnel_clone = tunnel.clone();

        tokio::spawn(async move {
            if let Err(e) = tunnel_clone.run().await {
                tracing::error!(error = %e, "QUIC tunnel error");
            }
        });

        Some(tunnel)
    } else {
        tracing::info!("QUIC obfuscation disabled (set QUIC_ENABLED=true to enable)");
        None
    };

    // Channel bonding aggregator (multi-path packet reassembly)
    if config.bonding.enabled {
        tracing::info!("Bonding layer enabled on port {}", config.bonding.port);
        let wg_port = config.wireguard.client_port;
        let sm = bonding_sessions.clone();
        let sock = ext_socket.clone();
        tokio::spawn(async move {
            if let Err(e) = bonding::BondingAggregator::run(sock, wg_port, sm).await {
                tracing::error!(error = %e, "Bonding aggregator error");
            }
        });
        capabilities.push("bonding");
    } else {
        tracing::info!("Bonding layer disabled (set BONDING_ENABLED=true to enable)");
    }

    // DNS Filter Proxy
    let dns_filter_handle = if config.dns_filter.enabled {
        tracing::info!(
            listen = format!(
                "{}:{}",
                config.dns_filter.listen_address, config.dns_filter.listen_port
            ),
            "DNS filter proxy enabled"
        );

        // Set up nftables DNS redirect rules
        if let Err(e) = netfilter::setup_dns_redirect(config.dns_filter.listen_port) {
            tracing::warn!(error = %e, "Failed to set up DNS redirect (DNS filter may not intercept client queries)");
        }

        let dns_config = config.dns_filter.clone();
        let handle = tokio::spawn(async move {
            let service = dns::DnsFilterService::new(&dns_config);
            if let Err(e) = service.start().await {
                tracing::error!(error = %e, "DNS filter service error");
            }
        });

        Some(handle)
    } else {
        tracing::info!("DNS filter disabled (set DNS_FILTER_ENABLED=true to enable)");
        None
    };

    tracing::info!(
        hostname = config.server.hostname,
        api = format!("{}:{}", config.api.bind_address, config.api.port),
        metrics = format!("{}:{}", config.api.bind_address, metrics_port),
        wg_clients = config.wireguard.client_port,
        wg_mesh = config.wireguard.mesh_port,
        quic = if config.quic.enabled {
            format!(":{}", config.quic.port)
        } else {
            "disabled".into()
        },
        "All systems operational"
    );

    // ========== Wait for shutdown signal ==========
    tokio::signal::ctrl_c().await?;

    tracing::info!("Shutdown signal received, draining...");

    // Drain: tell Supabase we're going offline so no new clients connect
    if let Err(e) = supabase
        .update_status(&server_id, &ServerStatus::Draining)
        .await
    {
        tracing::error!(error = %e, "Failed to set draining status");
    }

    // 2. Signal all services to stop
    let _ = shutdown_tx.send(true);

    // 3. Shut down QUIC tunnel gracefully
    if let Some(ref tunnel) = quic_tunnel {
        tunnel.shutdown();
        // Wait up to 10s for QUIC connections to drain
        tokio::select! {
            _ = tunnel.wait_idle() => {
                tracing::info!("QUIC connections drained");
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(10)) => {
                tracing::warn!("QUIC drain timeout, forcing shutdown");
            }
        }
    }

    // 4. Wait briefly for in-flight requests to complete
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // 5. Update status to offline
    if let Err(e) = supabase
        .update_status(&server_id, &ServerStatus::Offline)
        .await
    {
        tracing::error!(error = %e, "Failed to update status on shutdown");
    }
    prom::set_server_online(false);

    // 6. Clean up NAT rules and DNS redirect
    let _ = netfilter::teardown_nat();
    if config.dns_filter.enabled {
        let _ = netfilter::teardown_dns_redirect();
    }

    // 7. Abort remaining background tasks
    heartbeat_handle.abort();
    discovery_handle.abort();
    prober_handle.abort();
    responder_handle.abort();
    api_handle.abort();
    if let Some(handle) = dns_filter_handle {
        handle.abort();
    }

    tracing::info!("Shutdown complete");

    Ok(())
}

/// Detect the default WAN interface by parsing `ip route`
fn detect_wan_interface() -> Option<String> {
    let output = std::process::Command::new("ip")
        .args(["route", "show", "default"])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for part in stdout.split_whitespace().collect::<Vec<_>>().windows(2) {
        if part[0] == "dev" {
            return Some(part[1].to_string());
        }
    }

    None
}
