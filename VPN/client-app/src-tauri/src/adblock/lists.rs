use anyhow::{Context, Result};
use std::path::PathBuf;

/// Filter aggressiveness level, mapped to subscription tiers.
/// Basic = Free, Standard = Pro, Strict = Enterprise.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum FilterLevel {
    /// Basic blocking: major ad networks only (EasyList + EasyPrivacy)
    Basic,
    /// Standard blocking: + AdGuard, uBlock, Fanboy, OISD
    Standard,
    /// Strict blocking: + anti-adblock, phishing, malware, cryptominer
    Strict,
}

impl Default for FilterLevel {
    fn default() -> Self {
        Self::Standard
    }
}

/// Default client-side filter list URLs with tier assignments.
/// (name, url, minimum_required_level)
pub const DEFAULT_FILTER_LISTS: &[(&str, &str, FilterLevel)] = &[
    // ── Basic tier (Free) ─────────────────────────────────────────────
    ("EasyList", "https://easylist.to/easylist/easylist.txt", FilterLevel::Basic),
    ("EasyPrivacy", "https://easylist.to/easylist/easyprivacy.txt", FilterLevel::Basic),
    // ── Standard tier (Pro) ───────────────────────────────────────────
    ("AdGuard Base", "https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt", FilterLevel::Standard),
    ("AdGuard Tracking", "https://filters.adtidy.org/extension/ublock/filters/3.txt", FilterLevel::Standard),
    ("Fanboy Annoyances", "https://secure.fanboy.co.nz/fanboy-annoyance.txt", FilterLevel::Standard),
    ("AdGuard Annoyances", "https://filters.adtidy.org/extension/ublock/filters/14.txt", FilterLevel::Standard),
    ("uBlock Filters", "https://ublockorigin.github.io/uAssets/filters/filters.txt", FilterLevel::Standard),
    ("uBlock Annoyances", "https://ublockorigin.github.io/uAssets/filters/annoyances-others.txt", FilterLevel::Standard),
    ("uBlock Privacy", "https://ublockorigin.github.io/uAssets/filters/privacy.txt", FilterLevel::Standard),
    ("uBlock Badware", "https://ublockorigin.github.io/uAssets/filters/badware.txt", FilterLevel::Standard),
    // ── Strict tier (Enterprise) ──────────────────────────────────────
    ("Anti-Adblock Killer", "https://raw.githubusercontent.com/nickklos/anti_adblock/master/anti-adblock-killer-filters.txt", FilterLevel::Strict),
    ("Phishing URL Blocklist", "https://malware-filter.gitlab.io/malware-filter/phishing-filter.txt", FilterLevel::Strict),
    ("Malware URL Blocklist", "https://malware-filter.gitlab.io/malware-filter/urlhaus-filter.txt", FilterLevel::Strict),
    ("CoinBlocker", "https://zerodot1.gitlab.io/CoinBlockerLists/list_browser_UBO.txt", FilterLevel::Strict),
    ("AdGuard Social Media", "https://filters.adtidy.org/extension/ublock/filters/4.txt", FilterLevel::Strict),
    ("Fanboy Social", "https://easylist.to/easylist/fanboy-social.txt", FilterLevel::Strict),
    ("Peter Lowe Adservers", "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&mimetype=plaintext", FilterLevel::Strict),
];

/// Minimal embedded filter list for first-launch ad blocking before full lists download.
/// Contains only the most critical high-traffic ad/tracker domains.
pub const EMBEDDED_MINIMAL_RULES: &str = include_str!("embedded_filters.txt");

/// Manages filter list downloading, caching, and updates for the client-side adblock engine.
pub struct FilterListManager {
    /// Directory to store downloaded filter lists
    lists_dir: PathBuf,
    /// Configured filter list sources
    sources: Vec<FilterListSource>,
    /// Current filter level
    filter_level: FilterLevel,
}

/// A single filter list source configuration
#[derive(Debug, Clone)]
pub struct FilterListSource {
    pub name: String,
    pub url: String,
    pub enabled: bool,
    pub min_level: FilterLevel,
}

impl FilterListManager {
    /// Create a new FilterListManager with default filter list sources.
    pub fn new(data_dir: &std::path::Path) -> Self {
        let lists_dir = data_dir.join("adblock").join("filter_lists");

        let sources = DEFAULT_FILTER_LISTS
            .iter()
            .map(|(name, url, level)| FilterListSource {
                name: name.to_string(),
                url: url.to_string(),
                enabled: true,
                min_level: *level,
            })
            .collect();

        Self {
            lists_dir,
            sources,
            filter_level: FilterLevel::default(),
        }
    }

    /// Set the filter level (determines which lists are downloaded/used).
    pub fn set_filter_level(&mut self, level: FilterLevel) {
        self.filter_level = level;
    }

    /// Get the current filter level.
    pub fn filter_level(&self) -> FilterLevel {
        self.filter_level
    }

    /// Check if a source should be active given the current filter level.
    fn should_use_source(&self, source: &FilterListSource) -> bool {
        if !source.enabled {
            return false;
        }
        match self.filter_level {
            FilterLevel::Basic => source.min_level == FilterLevel::Basic,
            FilterLevel::Standard => {
                source.min_level == FilterLevel::Basic
                    || source.min_level == FilterLevel::Standard
            }
            FilterLevel::Strict => true, // All levels
        }
    }

    /// Get the filter lists directory path.
    pub fn lists_dir(&self) -> &std::path::Path {
        &self.lists_dir
    }

    /// Save the embedded minimal filter list to disk if no lists exist yet.
    pub async fn ensure_embedded_list(&self) -> Result<()> {
        tokio::fs::create_dir_all(&self.lists_dir)
            .await
            .context("Failed to create filter lists directory")?;

        let embedded_path = self.lists_dir.join("_embedded_minimal.txt");
        if !embedded_path.exists() {
            tokio::fs::write(&embedded_path, EMBEDDED_MINIMAL_RULES)
                .await
                .context("Failed to write embedded filter list")?;
            tracing::info!("Embedded minimal filter list saved to disk");
        }

        Ok(())
    }

    /// Download all configured filter lists to the lists directory.
    /// Only downloads lists appropriate for the current filter level.
    /// Returns the number of successfully downloaded lists.
    pub async fn download_all(&self) -> Result<usize> {
        tokio::fs::create_dir_all(&self.lists_dir)
            .await
            .context("Failed to create filter lists directory")?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .context("Failed to create HTTP client")?;

        let mut success_count = 0;

        for source in &self.sources {
            if !self.should_use_source(source) {
                continue;
            }

            let filename = sanitize_filename(&source.name);
            let path = self.lists_dir.join(format!("{}.txt", filename));

            tracing::info!(
                name = source.name.as_str(),
                url = source.url.as_str(),
                level = ?source.min_level,
                "Downloading filter list"
            );

            match client.get(&source.url).send().await {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        tracing::warn!(
                            name = source.name.as_str(),
                            status = %resp.status(),
                            "Filter list download returned non-200 status"
                        );
                        continue;
                    }

                    match resp.text().await {
                        Ok(content) => {
                            if content.is_empty() {
                                tracing::warn!(name = source.name.as_str(), "Filter list empty");
                                continue;
                            }

                            // Validate: should have filter rules (lines starting with ||, ##, etc.)
                            let rule_count = content.lines().filter(|l| {
                                let l = l.trim();
                                !l.is_empty() && !l.starts_with('!') && !l.starts_with('[')
                            }).count();

                            if rule_count < 10 {
                                tracing::warn!(
                                    name = source.name.as_str(),
                                    rules = rule_count,
                                    "Filter list has too few rules, skipping"
                                );
                                continue;
                            }

                            // Write atomically: write to .tmp then rename
                            let tmp_path = path.with_extension("tmp");
                            if let Err(e) = tokio::fs::write(&tmp_path, &content).await {
                                tracing::warn!(
                                    name = source.name.as_str(),
                                    error = %e,
                                    "Failed to write filter list"
                                );
                                continue;
                            }

                            if let Err(e) = tokio::fs::rename(&tmp_path, &path).await {
                                tracing::warn!(
                                    name = source.name.as_str(),
                                    error = %e,
                                    "Failed to rename filter list file"
                                );
                                let _ = tokio::fs::remove_file(&tmp_path).await;
                                continue;
                            }

                            tracing::info!(
                                name = source.name.as_str(),
                                rules = rule_count,
                                "Filter list downloaded"
                            );
                            success_count += 1;
                        }
                        Err(e) => {
                            tracing::warn!(name = source.name.as_str(), error = %e, "Failed to read response body");
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!(name = source.name.as_str(), error = %e, "Failed to download filter list");
                }
            }
        }

        tracing::info!(
            downloaded = success_count,
            total = self.sources.len(),
            level = ?self.filter_level,
            "Filter list download complete"
        );

        Ok(success_count)
    }

    /// Check if any filter lists exist on disk.
    pub async fn has_lists_on_disk(&self) -> bool {
        if let Ok(mut entries) = tokio::fs::read_dir(&self.lists_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                if entry.path().is_file() {
                    let name = entry.file_name();
                    let name = name.to_string_lossy();
                    // Skip the embedded minimal list and builtin rules when checking
                    if !name.starts_with('_') && name.ends_with(".txt") {
                        return true;
                    }
                }
            }
        }
        false
    }
}

/// Convert a filter list name to a safe filename
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .to_lowercase()
}
