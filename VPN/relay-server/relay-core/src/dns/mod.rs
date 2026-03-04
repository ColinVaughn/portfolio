pub mod blocklist;
pub mod cache;
pub mod cname;
pub mod proxy;
pub mod stats;

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;

use crate::config::DnsFilterConfig;
use blocklist::BlocklistManager;
use cname::CnameUncloaker;
use proxy::DnsProxy;

/// Top-level DNS filter service that owns the blocklist manager and DNS proxy.
pub struct DnsFilterService {
    blocklist_manager: Arc<BlocklistManager>,
    config: DnsFilterConfig,
}

impl DnsFilterService {
    /// Create a new DNS filter service from the given configuration.
    pub fn new(config: &DnsFilterConfig) -> Self {
        let blocklist_manager = Arc::new(BlocklistManager::new(
            PathBuf::from(&config.blocklist_dir),
            config.blocklist_urls.clone(),
            config.update_interval_hours,
        ));

        Self {
            blocklist_manager,
            config: config.clone(),
        }
    }

    /// Start the DNS filter service:
    /// 1. Load blocklists from disk (or download if none exist)
    /// 2. Spawn the auto-update loop
    /// 3. Spawn the DNS proxy listener
    pub async fn start(&self) -> Result<()> {
        // Load existing blocklists from disk
        let loaded = self.blocklist_manager.load_from_disk().await?;

        // If no domains were loaded, attempt an initial download
        if loaded == 0 && !self.config.blocklist_urls.is_empty() {
            tracing::info!("No blocklists found on disk, downloading initial lists...");
            match self.blocklist_manager.download_and_reload().await {
                Ok(count) => {
                    tracing::info!(domains = count, "Initial blocklist download complete");
                }
                Err(e) => {
                    tracing::warn!(
                        error = %e,
                        "Initial blocklist download failed, DNS filter will allow all queries until lists are available"
                    );
                }
            }
        }

        // Spawn the auto-update loop
        let manager_for_update = self.blocklist_manager.clone();
        tokio::spawn(async move {
            manager_for_update.auto_update_loop().await;
        });

        // Parse listen address
        let listen_addr: SocketAddr =
            format!("{}:{}", self.config.listen_address, self.config.listen_port)
                .parse()
                .map_err(|e| anyhow::anyhow!("Invalid DNS listen address: {e}"))?;

        // Parse upstream resolvers
        let upstream_resolvers: Vec<SocketAddr> = self
            .config
            .upstream_resolvers
            .iter()
            .filter_map(|s| {
                let addr = if s.contains(':') {
                    s.parse().ok()
                } else {
                    format!("{s}:53").parse().ok()
                };
                if addr.is_none() {
                    tracing::warn!(
                        resolver = s.as_str(),
                        "Failed to parse upstream resolver address"
                    );
                }
                addr
            })
            .collect();

        if upstream_resolvers.is_empty() {
            anyhow::bail!("No valid upstream DNS resolvers configured");
        }

        // Create CNAME uncloaker
        let cname_upstream = upstream_resolvers
            .first()
            .copied()
            .unwrap_or_else(|| "1.1.1.1:53".parse().unwrap());
        let cname_uncloaker = Arc::new(CnameUncloaker::new(
            cname_upstream,
            self.blocklist_manager.blocklist(),
        ));

        // Create DNS response cache
        let dns_cache = std::sync::Arc::new(cache::DnsCache::new());

        // Create and start the DNS proxy
        let proxy = DnsProxy::new(
            listen_addr,
            upstream_resolvers,
            self.blocklist_manager.blocklist(),
            cname_uncloaker,
            dns_cache,
        );

        tracing::info!(
            listen = %listen_addr,
            "DNS filter service starting"
        );

        // Set up nftables rules for DoH/DoT/QUIC blocking
        if self.config.block_dot {
            if let Err(e) = crate::routing::netfilter::setup_dot_blocking() {
                tracing::warn!(error = %e, "Failed to set up DoT blocking rules");
            }
        }
        if self.config.block_doh {
            if let Err(e) =
                crate::routing::netfilter::setup_doh_blocking(&self.config.doh_provider_ips)
            {
                tracing::warn!(error = %e, "Failed to set up DoH blocking rules");
            }
        }
        // Always block QUIC from WireGuard clients when DNS filter is active
        if let Err(e) = crate::routing::netfilter::setup_quic_blocking() {
            tracing::warn!(error = %e, "Failed to set up QUIC blocking rules");
        }

        proxy.run().await
    }
}
