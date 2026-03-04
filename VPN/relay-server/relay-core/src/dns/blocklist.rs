use anyhow::{Context, Result};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Manages DNS blocklists: loading from disk, parsing multiple formats, and hot-reloading.
pub struct BlocklistManager {
    /// Thread-safe domain blocklist for O(1) lookups
    blocklist: Arc<RwLock<HashSet<Box<str>>>>,
    /// Directory containing blocklist files
    blocklist_dir: PathBuf,
    /// URLs for downloading updated blocklists
    update_urls: Vec<String>,
    /// How often to auto-update (in hours)
    update_interval_hours: u64,
}

impl BlocklistManager {
    /// Create a new BlocklistManager with the given configuration.
    pub fn new(
        blocklist_dir: PathBuf,
        update_urls: Vec<String>,
        update_interval_hours: u64,
    ) -> Self {
        Self {
            blocklist: Arc::new(RwLock::new(HashSet::new())),
            blocklist_dir,
            update_urls,
            update_interval_hours,
        }
    }

    /// Get a shared reference to the blocklist for the DNS proxy to use.
    pub fn blocklist(&self) -> Arc<RwLock<HashSet<Box<str>>>> {
        self.blocklist.clone()
    }

    /// Load all blocklists from the configured directory.
    /// Supports hosts-file format, plain domain lists, and ABP syntax.
    pub async fn load_from_disk(&self) -> Result<usize> {
        let dir = &self.blocklist_dir;
        if !dir.exists() {
            tracing::warn!(dir = %dir.display(), "Blocklist directory does not exist, creating it");
            tokio::fs::create_dir_all(dir)
                .await
                .context("Failed to create blocklist directory")?;
            return Ok(0);
        }

        let mut domains = HashSet::new();
        let mut entries = tokio::fs::read_dir(dir)
            .await
            .context("Failed to read blocklist directory")?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            match tokio::fs::read_to_string(&path).await {
                Ok(content) => {
                    let count_before = domains.len();
                    parse_blocklist_content(&content, &mut domains);
                    let added = domains.len() - count_before;
                    tracing::info!(
                        file = %path.display(),
                        domains_added = added,
                        "Loaded blocklist file"
                    );
                }
                Err(e) => {
                    tracing::warn!(
                        file = %path.display(),
                        error = %e,
                        "Failed to read blocklist file, skipping"
                    );
                }
            }
        }

        let total = domains.len();
        let mut blocklist = self.blocklist.write().await;
        *blocklist = domains;

        tracing::info!(total_domains = total, "Blocklist loaded");

        // Update Prometheus gauge
        super::stats::set_blocklist_size(total);

        Ok(total)
    }

    /// Download updated blocklists from configured URLs and reload.
    pub async fn download_and_reload(&self) -> Result<usize> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .context("Failed to create HTTP client")?;

        tokio::fs::create_dir_all(&self.blocklist_dir)
            .await
            .context("Failed to create blocklist directory")?;

        for url in &self.update_urls {
            let filename = url_to_filename(url);
            let path = self.blocklist_dir.join(&filename);
            let etag_path = path.with_extension("etag");

            tracing::info!(url = url.as_str(), file = %path.display(), "Downloading blocklist");

            // Build request with conditional headers if we have a cached ETag
            let mut request = client.get(url);
            let cached_etag = tokio::fs::read_to_string(&etag_path).await.ok();
            if let Some(ref etag) = cached_etag {
                let etag_trimmed = etag.trim();
                if !etag_trimmed.is_empty() {
                    request = request.header("If-None-Match", etag_trimmed);
                }
            }

            // Also send If-Modified-Since if the file exists
            if let Ok(meta) = tokio::fs::metadata(&path).await {
                if let Ok(modified) = meta.modified() {
                    if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                        // Format as HTTP date (simplified  - just use the timestamp)
                        let ts = duration.as_secs();
                        request = request.header("If-Modified-Since", httpdate_from_timestamp(ts));
                    }
                }
            }

            match request.send().await {
                Ok(resp) => {
                    // 304 Not Modified  - blocklist hasn't changed
                    if resp.status() == reqwest::StatusCode::NOT_MODIFIED {
                        tracing::info!(
                            url = url.as_str(),
                            "Blocklist not modified (304), skipping download"
                        );
                        continue;
                    }

                    if !resp.status().is_success() {
                        tracing::warn!(
                            url = url.as_str(),
                            status = %resp.status(),
                            "Blocklist download returned non-200 status"
                        );
                        continue;
                    }

                    // Save the ETag from the response for next conditional request
                    if let Some(etag_value) = resp.headers().get("etag") {
                        if let Ok(etag_str) = etag_value.to_str() {
                            let _ = tokio::fs::write(&etag_path, etag_str).await;
                        }
                    }

                    match resp.text().await {
                        Ok(content) => {
                            if content.is_empty() {
                                tracing::warn!(
                                    url = url.as_str(),
                                    "Blocklist download returned empty content"
                                );
                                continue;
                            }

                            // Validate: must have at least some parseable lines
                            let mut test_set = HashSet::new();
                            parse_blocklist_content(&content, &mut test_set);
                            if test_set.is_empty() {
                                tracing::warn!(
                                    url = url.as_str(),
                                    "Blocklist contained no valid domains, skipping write"
                                );
                                continue;
                            }

                            // Write atomically: tmp then rename
                            let tmp_path = path.with_extension("tmp");
                            if let Err(e) = tokio::fs::write(&tmp_path, &content).await {
                                tracing::warn!(
                                    file = %path.display(),
                                    error = %e,
                                    "Failed to write blocklist file"
                                );
                            } else if let Err(e) = tokio::fs::rename(&tmp_path, &path).await {
                                tracing::warn!(
                                    file = %path.display(),
                                    error = %e,
                                    "Failed to rename blocklist file"
                                );
                                let _ = tokio::fs::remove_file(&tmp_path).await;
                            } else {
                                tracing::info!(
                                    url = url.as_str(),
                                    domains = test_set.len(),
                                    "Blocklist downloaded and saved"
                                );
                            }
                        }
                        Err(e) => {
                            tracing::warn!(url = url.as_str(), error = %e, "Failed to read blocklist response body");
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!(url = url.as_str(), error = %e, "Failed to download blocklist");
                }
            }
        }

        // Reload from disk after downloading
        self.load_from_disk().await
    }

    /// Background loop: periodically download updated blocklists.
    pub async fn auto_update_loop(self: Arc<Self>) {
        let interval = tokio::time::Duration::from_secs(self.update_interval_hours * 3600);

        loop {
            tokio::time::sleep(interval).await;

            tracing::info!("Starting scheduled blocklist update");
            match self.download_and_reload().await {
                Ok(total) => {
                    tracing::info!(total_domains = total, "Blocklist auto-update complete");
                }
                Err(e) => {
                    tracing::error!(error = %e, "Blocklist auto-update failed");
                }
            }
        }
    }
}

/// Parse blocklist content supporting three formats:
/// 1. Hosts-file format: `0.0.0.0 domain.com` or `127.0.0.1 domain.com`
/// 2. Plain domain list: `domain.com` (one per line)
/// 3. ABP syntax: `||domain.com^` (domain extraction only)
fn parse_blocklist_content(content: &str, domains: &mut HashSet<Box<str>>) {
    for line in content.lines() {
        let line = line.trim();

        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') || line.starts_with('!') {
            continue;
        }

        // ABP syntax: ||domain.com^  - extract domain
        if line.starts_with("||") {
            if let Some(rest) = line.strip_prefix("||") {
                // Find the caret (^) or end-of-line/options marker ($)
                let end = rest
                    .find('^')
                    .or_else(|| rest.find('$'))
                    .unwrap_or(rest.len());
                let domain = &rest[..end];

                // Only extract pure domain rules (no paths, wildcards)
                if !domain.is_empty()
                    && !domain.contains('/')
                    && !domain.contains('*')
                    && !domain.contains('?')
                    && domain.contains('.')
                {
                    let lower = domain.to_lowercase();
                    if lower != "localhost" {
                        domains.insert(lower.into_boxed_str());
                    }
                }
            }
            continue;
        }

        // Skip ABP exception rules and other filter syntax
        if line.starts_with("@@")
            || line.contains("##")
            || line.contains("#@#")
            || line.contains("##+js")
            || line.starts_with('[')
        {
            continue;
        }

        // Hosts-file format: "0.0.0.0 domain.com" or "127.0.0.1 domain.com"
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2
            && (parts[0] == "0.0.0.0" || parts[0] == "127.0.0.1" || parts[0] == "::1")
        {
            let domain = parts[1].to_lowercase();
            if domain != "localhost"
                && domain != "localhost.localdomain"
                && domain != "broadcasthost"
                && domain != "local"
                && domain.contains('.')
            {
                domains.insert(domain.into_boxed_str());
            }
            continue;
        }

        // Plain domain format: "domain.com" (single token, contains a dot, no spaces)
        if !line.contains(' ') && line.contains('.') && !line.starts_with('.') {
            // Validate it looks like a domain (alphanumeric + hyphens + dots)
            let appears_domain = line
                .chars()
                .all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_');
            if appears_domain {
                let lower = line.to_lowercase();
                if lower != "localhost" {
                    domains.insert(lower.into_boxed_str());
                }
            }
        }
    }
}

/// Convert a URL to a safe filename for blocklist storage.
fn url_to_filename(url: &str) -> String {
    let name = url
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .replace('/', "_")
        .replace(':', "_")
        .replace('?', "_")
        .replace('&', "_");

    // Truncate to avoid overly long filenames
    let truncated = if name.len() > 100 {
        &name[..100]
    } else {
        &name
    };

    format!("{}.txt", truncated)
}

/// Format a Unix timestamp as an HTTP date string for If-Modified-Since headers.
/// Format: "Thu, 01 Jan 2026 00:00:00 GMT" (RFC 7231 date)
fn httpdate_from_timestamp(ts: u64) -> String {
    const DAYS: [&str; 7] = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    // Calculate date components from Unix timestamp
    let secs_per_day: u64 = 86400;
    let days_since_epoch = ts / secs_per_day;
    let day_secs = ts % secs_per_day;

    let hours = day_secs / 3600;
    let minutes = (day_secs % 3600) / 60;
    let seconds = day_secs % 60;

    // Day of week (epoch was Thursday)
    let dow = days_since_epoch % 7;

    // Compute year/month/day from days since epoch using a simple algorithm
    let mut y = 1970i64;
    let mut remaining = days_since_epoch as i64;

    loop {
        let days_in_year = if is_leap_year(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }

    let month_days = if is_leap_year(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 0usize;
    for (i, &days) in month_days.iter().enumerate() {
        if remaining < days as i64 {
            m = i;
            break;
        }
        remaining -= days as i64;
    }

    let day = remaining + 1;

    format!(
        "{}, {:02} {} {:04} {:02}:{:02}:{:02} GMT",
        DAYS[dow as usize], day, MONTHS[m], y, hours, minutes, seconds
    )
}

fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/// Check if a domain or any of its parent domains is in the blocklist.
/// E.g., for "sub.ads.example.com", checks:
///   "sub.ads.example.com", "ads.example.com", "example.com"
pub fn is_domain_blocked(domain: &str, blocklist: &HashSet<Box<str>>) -> bool {
    let mut check = domain;
    loop {
        if blocklist.contains(check) {
            return true;
        }
        match check.find('.') {
            Some(pos) => check = &check[pos + 1..],
            None => return false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hosts_format() {
        let content = r#"
# Comment line
0.0.0.0 ads.example.com
127.0.0.1 tracker.example.com
0.0.0.0 localhost
0.0.0.0 localhost.localdomain
"#;
        let mut domains = HashSet::new();
        parse_blocklist_content(content, &mut domains);

        assert!(domains.contains("ads.example.com"));
        assert!(domains.contains("tracker.example.com"));
        assert!(!domains.contains("localhost"));
        assert!(!domains.contains("localhost.localdomain"));
        assert_eq!(domains.len(), 2);
    }

    #[test]
    fn test_parse_plain_domain_format() {
        let content = r#"
ads.example.com
tracker.example.com
invalid
localhost
"#;
        let mut domains = HashSet::new();
        parse_blocklist_content(content, &mut domains);

        assert!(domains.contains("ads.example.com"));
        assert!(domains.contains("tracker.example.com"));
        assert!(!domains.contains("invalid")); // no dot
        assert!(!domains.contains("localhost"));
    }

    #[test]
    fn test_parse_abp_format() {
        let content = r#"
! Title: Test List
||doubleclick.net^
||ads.example.com^
||tracker.com/path^
||wild*.example.com^
@@||allowed.com^
example.com##.ad-container
"#;
        let mut domains = HashSet::new();
        parse_blocklist_content(content, &mut domains);

        assert!(domains.contains("doubleclick.net"));
        assert!(domains.contains("ads.example.com"));
        // Should NOT include path-based or wildcard ABP rules
        assert!(!domains.contains("tracker.com/path"));
        assert!(!domains.contains("wild*.example.com"));
        // Should NOT include exception rules
        assert!(!domains.contains("allowed.com"));
        assert_eq!(domains.len(), 2);
    }

    #[test]
    fn test_is_domain_blocked() {
        let mut blocklist = HashSet::new();
        blocklist.insert("ads.example.com".into());
        blocklist.insert("tracker.com".into());

        assert!(is_domain_blocked("ads.example.com", &blocklist));
        assert!(is_domain_blocked("sub.ads.example.com", &blocklist));
        assert!(is_domain_blocked("deep.sub.ads.example.com", &blocklist));
        assert!(is_domain_blocked("tracker.com", &blocklist));
        assert!(is_domain_blocked("sub.tracker.com", &blocklist));
        assert!(!is_domain_blocked("example.com", &blocklist));
        assert!(!is_domain_blocked("safe-site.com", &blocklist));
    }

    #[test]
    fn test_url_to_filename() {
        let url = "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts";
        let filename = url_to_filename(url);
        assert!(filename.ends_with(".txt"));
        assert!(!filename.contains("https://"));
    }

    #[test]
    fn test_mixed_format_blocklist() {
        let content = r#"
# Hosts section
0.0.0.0 hosts-domain.com
# ABP section
||abp-domain.com^
# Plain section
plain-domain.com
"#;
        let mut domains = HashSet::new();
        parse_blocklist_content(content, &mut domains);

        assert!(domains.contains("hosts-domain.com"));
        assert!(domains.contains("abp-domain.com"));
        assert!(domains.contains("plain-domain.com"));
        assert_eq!(domains.len(), 3);
    }
}
