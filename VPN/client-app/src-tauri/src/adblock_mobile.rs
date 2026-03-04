/// Mobile ad-blocking service using DNS-level filtering.
///
/// This is the mobile counterpart of the desktop `AdblockService`.
/// Instead of a MITM proxy, it uses a `DnsFilter` to block ad/tracker
/// domains at the DNS level within the VPN tunnel.
///
/// The filter loads the same ABP-syntax filter lists as the desktop version
/// but only extracts domain-level rules (no URL patterns or cosmetic filters).

use crate::dns_filter::DnsFilter;
use anyhow::{Context, Result};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Filter level for mobile DNS blocking.
/// Mirrors the desktop `FilterLevel` enum for API compatibility.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MobileFilterLevel {
    Basic,
    Standard,
    Strict,
}

impl MobileFilterLevel {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "basic" => Self::Basic,
            "strict" => Self::Strict,
            _ => Self::Standard,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Basic => "Basic",
            Self::Standard => "Standard",
            Self::Strict => "Strict",
        }
    }
}

/// Mobile ad-blocking service.
///
/// Wraps a `DnsFilter` with lifecycle management (enable/disable),
/// filter list loading, and stats tracking.
pub struct MobileAdblockService {
    /// The underlying DNS filter
    filter: Arc<DnsFilter>,
    /// Data directory for storing filter lists
    data_dir: PathBuf,
    /// Current filter level
    filter_level: RwLock<MobileFilterLevel>,
}

/// Default filter list URLs for mobile DNS blocking.
/// Subset of the desktop lists  - only domain-based lists are useful here.
const MOBILE_FILTER_LISTS: &[(&str, &str, MobileFilterLevel)] = &[
    // Basic tier (Free)
    ("EasyList", "https://easylist.to/easylist/easylist.txt", MobileFilterLevel::Basic),
    ("EasyPrivacy", "https://easylist.to/easylist/easyprivacy.txt", MobileFilterLevel::Basic),
    // Standard tier (Pro)
    ("AdGuard Base", "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt", MobileFilterLevel::Standard),
    ("OISD Basic", "https://dbl.oisd.nl/basic/", MobileFilterLevel::Standard),
    // Strict tier (Enterprise)
    ("OISD Full", "https://dbl.oisd.nl/", MobileFilterLevel::Strict),
    ("Energized Spark", "https://energized.pro/spark/formats/filter", MobileFilterLevel::Strict),
];

/// Embedded minimal filter rules for immediate blocking before lists download.
const EMBEDDED_RULES: &str = include_str!("adblock/embedded_filters.txt");

impl MobileAdblockService {
    /// Create a new mobile adblock service (disabled by default).
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            filter: Arc::new(DnsFilter::new()),
            data_dir,
            filter_level: RwLock::new(MobileFilterLevel::Standard),
        }
    }

    /// Get a shared reference to the underlying `DnsFilter`.
    ///
    /// Used to share the filter with the VPN tunnel for packet processing.
    pub fn filter(&self) -> Arc<DnsFilter> {
        self.filter.clone()
    }

    /// Enable DNS ad blocking.
    ///
    /// Loads embedded rules immediately, then tries to load downloaded lists.
    pub async fn enable(&self) -> Result<()> {
        // Load embedded rules for immediate coverage
        self.filter.load_rules(EMBEDDED_RULES).await;

        // Load any previously downloaded lists from disk
        self.load_lists_from_disk().await?;

        self.filter.set_enabled(true).await;

        let domain_count = self.filter.blocked_domain_count().await;
        tracing::info!(domains = domain_count, "Mobile ad blocker enabled");

        Ok(())
    }

    /// Disable DNS ad blocking.
    pub async fn disable(&self) {
        self.filter.set_enabled(false).await;
        tracing::info!("Mobile ad blocker disabled");
    }

    /// Check if the ad blocker is currently enabled.
    pub async fn is_enabled(&self) -> bool {
        self.filter.is_enabled().await
    }

    /// Get statistics snapshot.
    pub fn get_stats(&self) -> MobileAdblockStats {
        let total = self.filter.queries_total();
        let blocked = self.filter.queries_blocked();
        let block_rate = if total > 0 {
            (blocked as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        MobileAdblockStats {
            queries_total: total,
            queries_blocked: blocked,
            block_rate_percent: (block_rate * 100.0).round() / 100.0,
        }
    }

    /// Reset stats counters.
    pub fn reset_stats(&self) {
        self.filter.reset_stats();
    }

    /// Get the current user whitelist.
    pub async fn get_whitelist(&self) -> Vec<String> {
        self.filter.get_whitelist().await
    }

    /// Add a domain to the user whitelist.
    pub async fn add_to_whitelist(&self, domain: String) {
        self.filter.add_to_whitelist(domain).await;
    }

    /// Remove a domain from the user whitelist.
    pub async fn remove_from_whitelist(&self, domain: &str) {
        self.filter.remove_from_whitelist(domain).await;
    }

    /// Get the current filter level.
    pub async fn get_filter_level(&self) -> String {
        self.filter_level.read().await.as_str().to_string()
    }

    /// Set the filter level and reload rules.
    pub async fn set_filter_level(&self, level: &str) -> Result<()> {
        let new_level = MobileFilterLevel::from_str(level);
        *self.filter_level.write().await = new_level;

        // Reload with new level
        self.filter.clear_rules().await;
        self.filter.load_rules(EMBEDDED_RULES).await;
        self.load_lists_from_disk().await?;

        let domain_count = self.filter.blocked_domain_count().await;
        tracing::info!(level = %level, domains = domain_count, "Filter level changed");
        Ok(())
    }

    /// Update filter lists by downloading from remote sources.
    ///
    /// Downloads lists appropriate for the current filter level.
    pub async fn update_filter_lists(&self) -> Result<usize> {
        let lists_dir = self.data_dir.join("dns_filter_lists");
        tokio::fs::create_dir_all(&lists_dir)
            .await
            .context("Failed to create DNS filter lists directory")?;

        let level = *self.filter_level.read().await;
        // Download all applicable filter lists in parallel
        let tasks: Vec<_> = MOBILE_FILTER_LISTS
            .iter()
            .filter(|(_, _, min_level)| should_include_list(level, *min_level))
            .map(|(name, url, _)| {
                let name = *name;
                let url = *url;
                let lists_dir = lists_dir.clone();
                tokio::spawn(async move {
                    match download_filter_list(url).await {
                        Ok(content) => {
                            let filename = sanitize_filename(name);
                            let path = lists_dir.join(format!("{}.txt", filename));
                            if let Err(e) = tokio::fs::write(&path, &content).await {
                                tracing::warn!(name, error = %e, "Failed to save filter list");
                                return false;
                            }
                            tracing::info!(name, url, "Downloaded filter list");
                            true
                        }
                        Err(e) => {
                            tracing::warn!(name, url, error = %e, "Failed to download filter list");
                            false
                        }
                    }
                })
            })
            .collect();

        let results = futures_util::future::join_all(tasks).await;
        let downloaded = results.iter().filter(|r| matches!(r, Ok(true))).count();

        // Reload rules from disk
        self.filter.clear_rules().await;
        self.filter.load_rules(EMBEDDED_RULES).await;
        self.load_lists_from_disk().await?;

        let domain_count = self.filter.blocked_domain_count().await;
        tracing::info!(downloaded, domains = domain_count, "Filter lists updated");

        Ok(downloaded)
    }

    /// Load all filter list files from the data directory.
    async fn load_lists_from_disk(&self) -> Result<()> {
        let lists_dir = self.data_dir.join("dns_filter_lists");
        if !lists_dir.exists() {
            return Ok(());
        }

        let mut entries = tokio::fs::read_dir(&lists_dir)
            .await
            .context("Failed to read DNS filter lists directory")?;

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.is_file() {
                match tokio::fs::read_to_string(&path).await {
                    Ok(content) => {
                        self.filter.load_rules(&content).await;
                        tracing::debug!(file = %path.display(), "Loaded DNS filter list");
                    }
                    Err(e) => {
                        tracing::warn!(
                            file = %path.display(),
                            error = %e,
                            "Failed to read DNS filter list"
                        );
                    }
                }
            }
        }

        Ok(())
    }
}

/// Stats snapshot for mobile ad blocking.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MobileAdblockStats {
    pub queries_total: u64,
    pub queries_blocked: u64,
    pub block_rate_percent: f64,
}

/// Check if a filter list should be included at the given level.
fn should_include_list(current: MobileFilterLevel, required: MobileFilterLevel) -> bool {
    match current {
        MobileFilterLevel::Basic => matches!(required, MobileFilterLevel::Basic),
        MobileFilterLevel::Standard => matches!(required, MobileFilterLevel::Basic | MobileFilterLevel::Standard),
        MobileFilterLevel::Strict => true,
    }
}

/// Download a filter list from a URL.
async fn download_filter_list(url: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let response = client.get(url).send().await?;
    let text = response.text().await?;
    Ok(text)
}

/// Sanitize a filter list name for use as a filename.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}
