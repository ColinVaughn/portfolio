/// DNS-based ad/tracker blocker.
///
/// Provides domain-level ad blocking by intercepting DNS queries within
/// the VPN tunnel. This is the mobile alternative to the desktop's full
/// MITM proxy  - simpler but effective for blocking ~80% of ads.
///
/// ## Architecture
///
/// ```text
/// TUN packet → extract_dns_from_ip_packet() → parse_dns_query()
///     → DnsFilter::check_domain() → if blocked → synthesize_blocked_response()
///     → wrap_dns_response_in_ip() → write back to TUN
/// ```

pub mod packet;
pub mod parser;

use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;

/// A DNS-level ad/tracker filter using a domain blocklist.
///
/// Thread-safe (interior mutability via `RwLock`) so it can be shared
/// between the tunnel loop and the command layer.
pub struct DnsFilter {
    /// Set of blocked domains (lowercase)
    blocked_domains: Arc<RwLock<HashSet<String>>>,
    /// Set of exception domains that bypass blocking (lowercase)
    exceptions: Arc<RwLock<HashSet<String>>>,
    /// User whitelist  - domains the user has explicitly allowed
    whitelist: Arc<RwLock<HashSet<String>>>,
    /// Whether the filter is currently active
    enabled: Arc<RwLock<bool>>,
    /// Stats counters
    queries_total: Arc<std::sync::atomic::AtomicU64>,
    queries_blocked: Arc<std::sync::atomic::AtomicU64>,
}

impl DnsFilter {
    /// Create a new empty DNS filter (disabled by default).
    pub fn new() -> Self {
        Self {
            blocked_domains: Arc::new(RwLock::new(HashSet::new())),
            exceptions: Arc::new(RwLock::new(HashSet::new())),
            whitelist: Arc::new(RwLock::new(HashSet::new())),
            enabled: Arc::new(RwLock::new(false)),
            queries_total: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            queries_blocked: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    /// Load domains from ABP-syntax filter rules text.
    ///
    /// This can be called multiple times to add rules from multiple lists.
    /// Domains are deduplicated automatically via the HashSet.
    pub async fn load_rules(&self, filter_text: &str) {
        let (blocked, exceptions) = parser::extract_domains(filter_text);

        let mut blocked_set = self.blocked_domains.write().await;
        for domain in blocked {
            blocked_set.insert(domain);
        }

        let mut exception_set = self.exceptions.write().await;
        for domain in exceptions {
            exception_set.insert(domain);
        }

        tracing::info!(
            blocked = blocked_set.len(),
            exceptions = exception_set.len(),
            "DNS filter rules loaded"
        );
    }

    /// Clear all loaded rules.
    pub async fn clear_rules(&self) {
        self.blocked_domains.write().await.clear();
        self.exceptions.write().await.clear();
    }

    /// Enable or disable the filter.
    pub async fn set_enabled(&self, enabled: bool) {
        *self.enabled.write().await = enabled;
        tracing::info!(enabled, "DNS filter toggled");
    }

    /// Check if the filter is enabled.
    pub async fn is_enabled(&self) -> bool {
        *self.enabled.read().await
    }

    /// Check if a domain should be blocked.
    ///
    /// Checks the domain itself and all parent domains. For example,
    /// if `google.com` is blocked, `ads.google.com` will also be blocked.
    ///
    /// Whitelisted and exception domains take precedence over blocks.
    pub async fn should_block(&self, domain: &str) -> bool {
        if !*self.enabled.read().await {
            return false;
        }

        let domain = domain.to_lowercase();

        // Check whitelist first (user-configured exceptions)
        let whitelist = self.whitelist.read().await;
        if domain_or_parent_in_set(&domain, &whitelist) {
            return false;
        }
        drop(whitelist);

        // Check ABP exception rules
        let exceptions = self.exceptions.read().await;
        if domain_or_parent_in_set(&domain, &exceptions) {
            return false;
        }
        drop(exceptions);

        // Check blocklist
        let blocked = self.blocked_domains.read().await;
        domain_or_parent_in_set(&domain, &blocked)
    }

    /// Process an outgoing IP packet from the TUN device.
    ///
    /// If the packet is a DNS query for a blocked domain, returns
    /// a synthesized response packet to write back to the TUN device.
    /// Otherwise returns `None` (packet should be forwarded normally).
    pub async fn process_packet(&self, ip_packet: &[u8]) -> Option<Vec<u8>> {
        // Only process if enabled
        if !*self.enabled.read().await {
            return None;
        }

        // Extract DNS payload from IP/UDP packet
        let dns_payload = packet::extract_dns_from_ip_packet(ip_packet)?;

        // Parse the DNS query
        let query = packet::parse_dns_query(dns_payload)?;

        // Update total query count
        self.queries_total.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        // Check if domain should be blocked
        if self.should_block(&query.domain).await {
            self.queries_blocked.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

            tracing::debug!(domain = %query.domain, "DNS query blocked");

            // Synthesize blocked response
            let dns_response = packet::synthesize_blocked_response(&query);

            // Wrap in IP/UDP packet
            packet::wrap_dns_response_in_ip(ip_packet, &dns_response)
        } else {
            None // Forward normally
        }
    }

    /// Get the total number of DNS queries seen.
    pub fn queries_total(&self) -> u64 {
        self.queries_total.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Get the total number of DNS queries blocked.
    pub fn queries_blocked(&self) -> u64 {
        self.queries_blocked.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Reset stats counters.
    pub fn reset_stats(&self) {
        self.queries_total.store(0, std::sync::atomic::Ordering::Relaxed);
        self.queries_blocked.store(0, std::sync::atomic::Ordering::Relaxed);
    }

    /// Get the number of domains in the blocklist.
    pub async fn blocked_domain_count(&self) -> usize {
        self.blocked_domains.read().await.len()
    }

    // ── Whitelist management ──

    /// Get the current user whitelist.
    pub async fn get_whitelist(&self) -> Vec<String> {
        self.whitelist.read().await.iter().cloned().collect()
    }

    /// Add a domain to the user whitelist.
    pub async fn add_to_whitelist(&self, domain: String) {
        self.whitelist.write().await.insert(domain.to_lowercase());
    }

    /// Remove a domain from the user whitelist.
    pub async fn remove_from_whitelist(&self, domain: &str) {
        self.whitelist.write().await.remove(&domain.to_lowercase());
    }

    /// Set the entire user whitelist, replacing existing entries.
    pub async fn set_whitelist(&self, domains: Vec<String>) {
        let mut wl = self.whitelist.write().await;
        wl.clear();
        for d in domains {
            wl.insert(d.to_lowercase());
        }
    }
}

/// Check if a domain or any of its parent domains is in a set.
///
/// For example, if the set contains `google.com`, then:
/// - `google.com` → true
/// - `ads.google.com` → true
/// - `sub.ads.google.com` → true
/// - `notgoogle.com` → false
fn domain_or_parent_in_set(domain: &str, set: &HashSet<String>) -> bool {
    // Check exact match first
    if set.contains(domain) {
        return true;
    }

    // Walk up parent domains
    let mut remaining = domain;
    while let Some(dot_pos) = remaining.find('.') {
        remaining = &remaining[dot_pos + 1..];
        if set.contains(remaining) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_should_block_exact_match() {
        let filter = DnsFilter::new();
        filter.set_enabled(true).await;
        filter.load_rules("||doubleclick.net^").await;

        assert!(filter.should_block("doubleclick.net").await);
        assert!(!filter.should_block("google.com").await);
    }

    #[tokio::test]
    async fn test_should_block_subdomain() {
        let filter = DnsFilter::new();
        filter.set_enabled(true).await;
        filter.load_rules("||google.com^").await;

        assert!(filter.should_block("ads.google.com").await);
        assert!(filter.should_block("deep.sub.google.com").await);
        assert!(!filter.should_block("notgoogle.com").await);
    }

    #[tokio::test]
    async fn test_whitelist_overrides_block() {
        let filter = DnsFilter::new();
        filter.set_enabled(true).await;
        filter.load_rules("||google.com^").await;
        filter.add_to_whitelist("ads.google.com".to_string()).await;

        assert!(filter.should_block("google.com").await);
        assert!(!filter.should_block("ads.google.com").await); // whitelisted
    }

    #[tokio::test]
    async fn test_exception_rules() {
        let filter = DnsFilter::new();
        filter.set_enabled(true).await;
        filter.load_rules("||google.com^\n@@||safe.google.com^").await;

        assert!(filter.should_block("google.com").await);
        assert!(!filter.should_block("safe.google.com").await); // exception
    }

    #[tokio::test]
    async fn test_disabled_blocks_nothing() {
        let filter = DnsFilter::new();
        // not enabled
        filter.load_rules("||doubleclick.net^").await;

        assert!(!filter.should_block("doubleclick.net").await);
    }

    #[tokio::test]
    async fn test_domain_parent_matching() {
        assert!(domain_or_parent_in_set("ads.google.com", &HashSet::from(["google.com".to_string()])));
        assert!(domain_or_parent_in_set("google.com", &HashSet::from(["google.com".to_string()])));
        assert!(!domain_or_parent_in_set("notgoogle.com", &HashSet::from(["google.com".to_string()])));
    }
}
