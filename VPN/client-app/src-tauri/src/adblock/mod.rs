pub mod cert;
pub mod crash_guard;
pub mod engine;
pub mod lists;
pub mod proxy;
pub mod quic;
pub mod stats;
pub mod sysproxy;
pub mod webrtc;

use anyhow::{Context, Result};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use cert::CertManager;
use engine::AdblockEngine;
use lists::FilterListManager;
use proxy::AdblockProxy;
use quic::QuicBlocker;
use stats::{AdblockStats, AdblockStatsSnapshot};
use sysproxy::SystemProxy;

/// Default local proxy port
const DEFAULT_PROXY_PORT: u16 = 9898;
/// Default proxy bind address
const DEFAULT_PROXY_HOST: &str = "127.0.0.1";

/// Top-level adblock service that manages the full lifecycle:
/// certificate generation, filter list management, MITM proxy, and system proxy config.
pub struct AdblockService {
    /// Whether the adblock system is currently active
    enabled: bool,
    /// Proxy listen address
    proxy_addr: SocketAddr,
    /// Certificate manager
    cert_manager: Arc<CertManager>,
    /// Adblock engine
    engine: Arc<AdblockEngine>,
    /// Filter list manager
    list_manager: FilterListManager,
    /// Statistics tracker
    stats: Arc<AdblockStats>,
    /// System proxy manager
    system_proxy: SystemProxy,
    /// QUIC/HTTP3 blocker (forces TCP fallback)
    quic_blocker: QuicBlocker,
    /// Handle to the running proxy task
    proxy_handle: Option<tokio::task::JoinHandle<()>>,
    /// Handle to the filter update task
    update_handle: Option<tokio::task::JoinHandle<()>>,
    /// Data directory for storing certs, lists, etc.
    data_dir: PathBuf,
    /// Watchdog task handle
    watchdog_handle: Option<tokio::task::JoinHandle<()>>,
    /// Shared flag for watchdog to know if system proxy is enabled
    proxy_enabled_flag: Arc<AtomicBool>,
}

impl AdblockService {
    /// Create a new AdblockService. Does NOT start the proxy yet.
    pub fn new(data_dir: PathBuf) -> Result<Self> {
        let cert_manager = Arc::new(
            CertManager::load_or_generate(&data_dir)
                .context("Failed to initialize certificate manager")?,
        );

        let list_manager = FilterListManager::new(&data_dir);

        let engine = Arc::new(AdblockEngine::new(
            list_manager.lists_dir().to_path_buf(),
        ));

        let proxy_addr: SocketAddr = format!("{DEFAULT_PROXY_HOST}:{DEFAULT_PROXY_PORT}")
            .parse()
            .context("Failed to parse proxy address")?;

        let system_proxy = SystemProxy::new(DEFAULT_PROXY_HOST, DEFAULT_PROXY_PORT);
        let stats = Arc::new(AdblockStats::new());
        let quic_blocker = QuicBlocker::new();
        let proxy_enabled_flag = Arc::new(AtomicBool::new(false));

        // Clean up stale proxy/QUIC rules from a previous crash
        if let Err(e) = crash_guard::cleanup_stale_proxy() {
            tracing::warn!(error = %e, "Failed to clean up stale proxy settings");
        }

        Ok(Self {
            enabled: false,
            proxy_addr,
            cert_manager,
            engine,
            list_manager,
            stats,
            system_proxy,
            quic_blocker,
            proxy_handle: None,
            update_handle: None,
            data_dir,
            watchdog_handle: None,
            proxy_enabled_flag,
        })
    }

    /// Start the adblock system:
    /// 1. Ensure embedded filters exist on disk
    /// 2. Load filter lists into the engine
    /// 3. Start the MITM proxy
    /// 4. Enable system proxy
    /// 5. Start background filter list updater
    pub async fn start(&mut self) -> Result<()> {
        if self.enabled {
            tracing::warn!("Adblock service already running");
            return Ok(());
        }

        tracing::info!("Starting adblock service...");

        // 0. Install crash recovery panic hook (first time only)
        crash_guard::install_panic_hook();

        // 1. Ensure embedded minimal list is on disk
        self.list_manager
            .ensure_embedded_list()
            .await
            .context("Failed to ensure embedded filter list")?;

        // 2. If no full lists exist, start a background download
        if !self.list_manager.has_lists_on_disk().await {
            tracing::info!("No filter lists on disk, starting initial download...");
            let download_result = self.list_manager.download_all().await;
            match download_result {
                Ok(count) => {
                    tracing::info!(count, "Initial filter list download complete");
                }
                Err(e) => {
                    tracing::warn!(error = %e, "Initial filter list download failed, using embedded list");
                }
            }
        }

        // 3. Load filter lists into the engine
        match self.engine.load_from_disk().await {
            Ok(count) => {
                tracing::info!(rules = count, "Filter lists loaded into engine");
            }
            Err(e) => {
                tracing::warn!(error = %e, "Failed to load filter lists, engine will block nothing");
            }
        }

        // 3b. Load built-in DoH blocking rules (always active)
        self.engine.load_builtin_doh_rules().await;

        // 4. Start the MITM proxy
        let ca_cert_path = self.cert_manager.ca_cert_path().to_path_buf();
        let ca_key_path = ca_cert_path.with_file_name("rootCA-key.pem");

        let mitm = AdblockProxy::new(
            self.proxy_addr,
            self.engine.clone(),
            self.stats.clone(),
            ca_cert_path,
            ca_key_path,
        );

        let proxy_handle = tokio::spawn(async move {
            if let Err(e) = mitm.run().await {
                tracing::error!(error = %e, "MITM proxy error");
            }
        });
        self.proxy_handle = Some(proxy_handle);

        // 5. Enable system proxy
        self.system_proxy.enable()
            .context("Failed to enable system proxy")?;
        self.proxy_enabled_flag.store(true, std::sync::atomic::Ordering::SeqCst);

        // 6. Block QUIC/HTTP3 to force browsers to use TCP (filterable)
        if let Err(e) = self.quic_blocker.enable() {
            tracing::warn!(error = %e, "Failed to enable QUIC blocker (HTTP3 traffic may bypass proxy)");
        }

        // 7. Start background filter list updater (every 24h)
        let engine_for_update = self.engine.clone();
        let lists_dir = self.list_manager.lists_dir().to_path_buf();
        let update_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(86400));
            interval.tick().await; // Skip the first immediate tick
            loop {
                interval.tick().await;
                tracing::info!("Starting scheduled filter list update");

                // Download new lists
                let list_mgr = FilterListManager::new(lists_dir.parent().unwrap().parent().unwrap());
                match list_mgr.download_all().await {
                    Ok(count) => {
                        tracing::info!(count, "Filter list update downloaded");
                    }
                    Err(e) => {
                        tracing::error!(error = %e, "Filter list update download failed");
                        continue;
                    }
                }

                // Reload engine
                match engine_for_update.load_from_disk().await {
                    Ok(rules) => {
                        tracing::info!(rules, "Engine reloaded with updated filter lists");
                    }
                    Err(e) => {
                        tracing::error!(error = %e, "Failed to reload engine after update");
                    }
                }
            }
        });
        self.update_handle = Some(update_handle);

        // 8. Spawn watchdog to monitor proxy health
        let watchdog_proxy_handle = Arc::new(tokio::sync::Mutex::new(
            self.proxy_handle.take()
        ));
        let watchdog = crash_guard::spawn_watchdog(
            watchdog_proxy_handle.clone(),
            self.proxy_enabled_flag.clone(),
        );
        // Move the proxy handle back (watchdog has a clone of the Arc)
        self.proxy_handle = watchdog_proxy_handle.lock().await.take();
        self.watchdog_handle = Some(watchdog);

        self.enabled = true;
        tracing::info!(
            proxy = %self.proxy_addr,
            "Adblock service started"
        );

        Ok(())
    }

    /// Stop the adblock system:
    /// 1. Disable system proxy
    /// 2. Abort the proxy task
    /// 3. Abort the update task
    pub async fn stop(&mut self) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        tracing::info!("Stopping adblock service...");

        // Disable system proxy first (critical path)
        if let Err(e) = self.system_proxy.disable() {
            tracing::error!(error = %e, "Failed to disable system proxy");
        }
        self.proxy_enabled_flag.store(false, std::sync::atomic::Ordering::SeqCst);

        // Disable QUIC blocker
        if let Err(e) = self.quic_blocker.disable() {
            tracing::error!(error = %e, "Failed to disable QUIC blocker");
        }

        // Abort watchdog task
        if let Some(handle) = self.watchdog_handle.take() {
            handle.abort();
        }

        // Abort proxy task
        if let Some(handle) = self.proxy_handle.take() {
            handle.abort();
        }

        // Abort update task
        if let Some(handle) = self.update_handle.take() {
            handle.abort();
        }

        self.enabled = false;
        tracing::info!("Adblock service stopped");

        Ok(())
    }

    /// Check if the adblock service is currently running
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Get the current stats snapshot
    pub async fn get_stats(&self) -> AdblockStatsSnapshot {
        self.stats.snapshot().await
    }

    /// Reset stats counters
    pub async fn reset_stats(&self) {
        self.stats.reset().await;
    }

    /// Install the Root CA certificate into the system trust store
    pub fn install_root_ca(&self) -> Result<String> {
        self.cert_manager.install_root_ca()
    }

    /// Get the path to the Root CA certificate file
    pub fn ca_cert_path(&self) -> String {
        self.cert_manager.ca_cert_path().to_string_lossy().to_string()
    }

    /// Force a filter list update and engine reload
    pub async fn update_filter_lists(&self) -> Result<usize> {
        let list_mgr = FilterListManager::new(&self.data_dir);
        let count = list_mgr.download_all().await?;
        let rules = self.engine.load_from_disk().await?;
        tracing::info!(lists = count, rules, "Manual filter list update complete");
        Ok(rules)
    }

    // ── Whitelist Management ──

    /// Get the current whitelist (domains that bypass blocking)
    pub async fn get_whitelist(&self) -> Vec<String> {
        let path = self.data_dir.join("adblock").join("whitelist.json");
        match tokio::fs::read_to_string(&path).await {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    /// Set the entire whitelist, replacing any existing entries
    pub async fn set_whitelist(&self, domains: Vec<String>) -> Result<()> {
        let dir = self.data_dir.join("adblock");
        tokio::fs::create_dir_all(&dir).await?;
        let path = dir.join("whitelist.json");
        let json = serde_json::to_string_pretty(&domains)?;
        tokio::fs::write(&path, json).await?;

        // Tell the engine about the whitelist
        self.engine.set_whitelist(domains).await;
        tracing::info!("Whitelist updated");
        Ok(())
    }

    /// Add a domain to the whitelist
    pub async fn add_to_whitelist(&self, domain: String) -> Result<()> {
        let mut list = self.get_whitelist().await;
        let normalized = domain.to_lowercase().trim().to_string();
        if !list.contains(&normalized) {
            list.push(normalized);
            self.set_whitelist(list).await?;
        }
        Ok(())
    }

    /// Remove a domain from the whitelist
    pub async fn remove_from_whitelist(&self, domain: &str) -> Result<()> {
        let mut list = self.get_whitelist().await;
        let normalized = domain.to_lowercase();
        list.retain(|d| d != &normalized);
        self.set_whitelist(list).await?;
        Ok(())
    }

    // ── Filter Level ──

    /// Get the current filter level
    pub fn get_filter_level(&self) -> String {
        format!("{:?}", self.list_manager.filter_level())
    }

    /// Set the filter level (Basic, Standard, Strict)
    pub async fn set_filter_level(&mut self, level: &str) -> Result<()> {
        let filter_level = match level {
            "Basic" => lists::FilterLevel::Basic,
            "Standard" => lists::FilterLevel::Standard,
            "Strict" => lists::FilterLevel::Strict,
            _ => return Err(anyhow::anyhow!("Invalid filter level: {}", level)),
        };
        self.list_manager.set_filter_level(filter_level);
        tracing::info!(level, "Filter level changed");
        Ok(())
    }

    // ── Debug Log ──

    /// Toggle debug logging on/off
    pub async fn set_debug_logging(&self, enabled: bool) {
        self.stats.set_debug_logging(enabled).await;
        tracing::info!(enabled, "Adblock debug logging toggled");
    }

    /// Check if debug logging is enabled
    pub async fn is_debug_logging(&self) -> bool {
        self.stats.is_debug_logging().await
    }
}
