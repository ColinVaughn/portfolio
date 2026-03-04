use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Maximum number of recent blocked entries to keep in memory
const MAX_RECENT_ENTRIES: usize = 100;

/// Ad blocker statistics and recent blocked request log.
pub struct AdblockStats {
    inner: Arc<RwLock<StatsInner>>,
}

struct StatsInner {
    /// Total requests intercepted
    requests_total: u64,
    /// Total requests blocked
    requests_blocked: u64,
    /// Estimated bytes saved by blocking
    bytes_saved: u64,
    /// Recent blocked requests (ring buffer)
    recent_blocked: VecDeque<BlockedEntry>,
    /// Whether debug logging is currently enabled
    debug_logging_enabled: bool,
}

/// A single blocked request entry for the debug log
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockedEntry {
    pub url: String,
    pub source_url: String,
    pub request_type: String,
    pub filter_rule: Option<String>,
    pub timestamp: String,
}

/// Serializable stats snapshot returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdblockStatsSnapshot {
    pub requests_total: u64,
    pub requests_blocked: u64,
    pub bytes_saved: u64,
    pub block_rate_percent: f64,
    pub recent_blocked: Vec<BlockedEntry>,
    pub debug_logging_enabled: bool,
}

impl AdblockStats {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(StatsInner {
                requests_total: 0,
                requests_blocked: 0,
                bytes_saved: 0,
                recent_blocked: VecDeque::with_capacity(MAX_RECENT_ENTRIES),
                debug_logging_enabled: false,
            })),
        }
    }

    /// Toggle whether debug logging is enabled
    pub async fn set_debug_logging(&self, enabled: bool) {
        let mut inner = self.inner.write().await;
        inner.debug_logging_enabled = enabled;
        if !enabled {
            // Clear the log when disabled to save memory quickly
            inner.recent_blocked.clear();
        }
    }

    /// Check if debug logging is enabled
    pub async fn is_debug_logging(&self) -> bool {
        let inner = self.inner.read().await;
        inner.debug_logging_enabled
    }

    /// Record a request that was allowed (passed through)
    pub async fn record_allowed(&self, url: &str, source_url: &str, request_type: &str) {
        let mut inner = self.inner.write().await;
        inner.requests_total += 1;
        
        // Also log allowed requests if debug logging is enabled
        if inner.debug_logging_enabled {
            let entry = BlockedEntry {
                url: truncate_url(url, 200),
                source_url: truncate_url(source_url, 200),
                request_type: request_type.to_string(),
                filter_rule: None, // None means allowed
                timestamp: chrono::Utc::now().to_rfc3339(),
            };

            if inner.recent_blocked.len() >= MAX_RECENT_ENTRIES {
                inner.recent_blocked.pop_front();
            }
            inner.recent_blocked.push_back(entry);
        }
    }

    /// Record a request that was blocked
    pub async fn record_blocked(
        &self,
        url: &str,
        source_url: &str,
        request_type: &str,
        filter_rule: Option<String>,
        estimated_size: u64,
    ) {
        let mut inner = self.inner.write().await;
        inner.requests_total += 1;
        inner.requests_blocked += 1;
        inner.bytes_saved += estimated_size;

        // Add to recent blocked log
        let entry = BlockedEntry {
            url: truncate_url(url, 200),
            source_url: truncate_url(source_url, 200),
            request_type: request_type.to_string(),
            filter_rule,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        if inner.recent_blocked.len() >= MAX_RECENT_ENTRIES {
            inner.recent_blocked.pop_front();
        }
        inner.recent_blocked.push_back(entry);
    }

    /// Get a snapshot of the current stats
    pub async fn snapshot(&self) -> AdblockStatsSnapshot {
        let inner = self.inner.read().await;
        let block_rate = if inner.requests_total > 0 {
            (inner.requests_blocked as f64 / inner.requests_total as f64) * 100.0
        } else {
            0.0
        };

        AdblockStatsSnapshot {
            requests_total: inner.requests_total,
            requests_blocked: inner.requests_blocked,
            bytes_saved: inner.bytes_saved,
            block_rate_percent: (block_rate * 100.0).round() / 100.0,
            recent_blocked: inner.recent_blocked.iter().cloned().collect(),
            debug_logging_enabled: inner.debug_logging_enabled,
        }
    }

    /// Reset all stats counters
    pub async fn reset(&self) {
        let mut inner = self.inner.write().await;
        inner.requests_total = 0;
        inner.requests_blocked = 0;
        inner.bytes_saved = 0;
        inner.recent_blocked.clear();
    }
}

/// Truncate a URL to a max length for display/logging
fn truncate_url(url: &str, max_len: usize) -> String {
    if url.len() <= max_len {
        url.to_string()
    } else {
        format!("{}...", &url[..max_len])
    }
}
