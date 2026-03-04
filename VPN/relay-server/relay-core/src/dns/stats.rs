use metrics::{counter, gauge};

/// Record a DNS query received
pub fn record_dns_query() {
    counter!("relay_dns_queries_total").increment(1);
}

/// Record a DNS query that was blocked
pub fn record_dns_blocked() {
    counter!("relay_dns_queries_blocked_total").increment(1);
}

/// Record a DNS query that was allowed (forwarded upstream)
pub fn record_dns_allowed() {
    counter!("relay_dns_queries_allowed_total").increment(1);
}

/// Record a DNS upstream forwarding error
pub fn record_dns_upstream_error() {
    counter!("relay_dns_upstream_errors_total").increment(1);
}

/// Record a DNS parse error (malformed query)
pub fn record_dns_parse_error() {
    counter!("relay_dns_parse_errors_total").increment(1);
}

/// Update the blocklist size gauge
pub fn set_blocklist_size(size: usize) {
    gauge!("relay_dns_blocklist_domains").set(size as f64);
}

/// Set the DNS filter enabled status gauge (1 = enabled, 0 = disabled)
pub fn set_dns_filter_enabled(enabled: bool) {
    gauge!("relay_dns_filter_enabled").set(if enabled { 1.0 } else { 0.0 });
}

/// Record a DNS query blocked via CNAME uncloaking
pub fn record_dns_cname_block() {
    counter!("relay_dns_cname_blocks_total").increment(1);
}

/// Record a DNS cache hit
pub fn record_dns_cache_hit() {
    counter!("relay_dns_cache_hits_total").increment(1);
}

/// Record a DNS cache miss
pub fn record_dns_cache_miss() {
    counter!("relay_dns_cache_misses_total").increment(1);
}

/// Set the current DNS cache size
pub fn set_dns_cache_size(size: usize) {
    gauge!("relay_dns_cache_entries").set(size as f64);
}
