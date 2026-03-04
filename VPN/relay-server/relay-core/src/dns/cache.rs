use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use super::stats;

/// Maximum number of entries in the DNS response cache
const MAX_CACHE_ENTRIES: usize = 50_000;
/// Minimum TTL for cached entries (prevents caching for too short a time)
const MIN_CACHE_TTL: Duration = Duration::from_secs(30);
/// Maximum TTL for cached entries (prevents stale entries lingering too long)
const MAX_CACHE_TTL: Duration = Duration::from_secs(3600); // 1 hour
/// Default TTL if we can't extract one from the DNS response
const DEFAULT_CACHE_TTL: Duration = Duration::from_secs(300); // 5 minutes

/// Cache key: (domain, query_type)
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
struct CacheKey {
    domain: String,
    query_type: u16,
}

/// Cached DNS response entry
struct CacheEntry {
    /// The raw DNS response bytes
    response: Vec<u8>,
    /// When this entry was inserted
    inserted_at: Instant,
    /// How long this entry is valid
    ttl: Duration,
    /// Number of times this entry has been served
    hit_count: u64,
}

impl CacheEntry {
    fn is_expired(&self) -> bool {
        self.inserted_at.elapsed() > self.ttl
    }
}

/// TTL-aware DNS response cache.
///
/// Caches upstream DNS responses to reduce latency and upstream load.
/// - Key: (domain, query_type)  - e.g., ("example.com", 1) for A records
/// - Value: full DNS response bytes with TTL extracted from the response
/// - LRU-style eviction when cache is full (removes expired first, then least-hit entries)
///
/// Blocked responses are NOT cached (they're generated instantly from the blocklist).
pub struct DnsCache {
    entries: Arc<RwLock<HashMap<CacheKey, CacheEntry>>>,
}

impl DnsCache {
    /// Create a new empty DNS cache.
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Look up a cached response for the given domain and query type.
    /// Returns the cached response if it exists and hasn't expired.
    pub async fn get(&self, domain: &str, query_type: u16, query_id: u16) -> Option<Vec<u8>> {
        let key = CacheKey {
            domain: domain.to_lowercase(),
            query_type,
        };

        let mut entries = self.entries.write().await;

        if let Some(entry) = entries.get_mut(&key) {
            if entry.is_expired() {
                entries.remove(&key);
                stats::record_dns_cache_miss();
                return None;
            }

            entry.hit_count += 1;
            stats::record_dns_cache_hit();

            // Clone the response and update the transaction ID to match the current query
            let mut response = entry.response.clone();
            if response.len() >= 2 {
                response[0] = (query_id >> 8) as u8;
                response[1] = (query_id & 0xFF) as u8;
            }

            // Adjust the TTL in the response to reflect remaining cache time
            let elapsed = entry.inserted_at.elapsed();
            let remaining = entry.ttl.saturating_sub(elapsed);
            adjust_response_ttl(&mut response, remaining.as_secs() as u32);

            Some(response)
        } else {
            stats::record_dns_cache_miss();
            None
        }
    }

    /// Insert a DNS response into the cache.
    /// Extracts the TTL from the response's answer section.
    pub async fn insert(&self, domain: &str, query_type: u16, response: &[u8]) {
        let key = CacheKey {
            domain: domain.to_lowercase(),
            query_type,
        };

        // Extract TTL from the DNS response
        let ttl = extract_min_ttl(response)
            .map(|t| Duration::from_secs(t as u64))
            .unwrap_or(DEFAULT_CACHE_TTL)
            .max(MIN_CACHE_TTL)
            .min(MAX_CACHE_TTL);

        let entry = CacheEntry {
            response: response.to_vec(),
            inserted_at: Instant::now(),
            ttl,
            hit_count: 0,
        };

        let mut entries = self.entries.write().await;

        // Evict if at capacity
        if entries.len() >= MAX_CACHE_ENTRIES {
            self.evict(&mut entries);
        }

        entries.insert(key, entry);

        // Update cache size metric
        stats::set_dns_cache_size(entries.len());
    }

    /// Evict entries to make room for new ones.
    /// Strategy: remove expired entries first, then least-hit entries.
    fn evict(&self, entries: &mut HashMap<CacheKey, CacheEntry>) {
        let before = entries.len();

        // First pass: drop everything that's past its TTL
        entries.retain(|_, entry| !entry.is_expired());

        // If we freed enough space, we're done
        if entries.len() < MAX_CACHE_ENTRIES * 3 / 4 {
            tracing::debug!(
                evicted = before - entries.len(),
                remaining = entries.len(),
                "DNS cache: evicted expired entries"
            );
            return;
        }

        // Still too full, trim the bottom 25% by hit count
        let target_size = MAX_CACHE_ENTRIES * 3 / 4;
        let mut hit_counts: Vec<u64> = entries.values().map(|e| e.hit_count).collect();
        hit_counts.sort_unstable();

        if let Some(&threshold) = hit_counts.get(entries.len().saturating_sub(target_size)) {
            entries.retain(|_, entry| entry.hit_count > threshold);
        }

        tracing::debug!(
            evicted = before - entries.len(),
            remaining = entries.len(),
            "DNS cache: evicted low-hit entries"
        );
    }

    /// Get the current cache size.
    pub async fn size(&self) -> usize {
        self.entries.read().await.len()
    }
}

/// Extract the minimum TTL from all answer records in a DNS response.
/// This is the appropriate TTL to cache the whole response for.
fn extract_min_ttl(response: &[u8]) -> Option<u32> {
    if response.len() < 12 {
        return None;
    }

    let ancount = u16::from_be_bytes([response[6], response[7]]);
    if ancount == 0 {
        return None;
    }

    // Skip header (12 bytes) + question section
    let mut pos = 12;

    // Skip question section
    let qdcount = u16::from_be_bytes([response[4], response[5]]);
    for _ in 0..qdcount {
        pos = skip_name(response, pos)?;
        pos += 4; // QTYPE + QCLASS
    }

    let mut min_ttl = u32::MAX;

    // Parse answer section
    for _ in 0..ancount {
        if pos >= response.len() {
            break;
        }

        // Skip name
        pos = skip_name(response, pos)?;

        if pos + 10 > response.len() {
            break;
        }

        // Read TTL (4 bytes at offset +4 in the RR header)
        let ttl = u32::from_be_bytes([
            response[pos + 4],
            response[pos + 5],
            response[pos + 6],
            response[pos + 7],
        ]);

        let rdlength = u16::from_be_bytes([response[pos + 8], response[pos + 9]]) as usize;
        pos += 10 + rdlength;

        min_ttl = min_ttl.min(ttl);
    }

    if min_ttl == u32::MAX {
        None
    } else {
        Some(min_ttl)
    }
}

/// Skip a DNS name, handling compression pointers.
fn skip_name(data: &[u8], mut pos: usize) -> Option<usize> {
    loop {
        if pos >= data.len() {
            return None;
        }
        let len = data[pos] as usize;
        if len == 0 {
            return Some(pos + 1);
        }
        if len >= 0xC0 {
            return Some(pos + 2); // Compression pointer
        }
        pos += 1 + len;
    }
}

/// Adjust TTL values in all answer/authority/additional records of a DNS response.
/// This ensures clients receive accurate remaining TTL values from cached responses.
fn adjust_response_ttl(response: &mut [u8], remaining_secs: u32) {
    if response.len() < 12 {
        return;
    }

    let ancount = u16::from_be_bytes([response[6], response[7]]) as usize;
    let nscount = u16::from_be_bytes([response[8], response[9]]) as usize;
    let arcount = u16::from_be_bytes([response[10], response[11]]) as usize;
    let total_rr = ancount + nscount + arcount;

    // Skip header + question section
    let mut pos = 12;

    let qdcount = u16::from_be_bytes([response[4], response[5]]);
    for _ in 0..qdcount {
        match skip_name(response, pos) {
            Some(p) => pos = p + 4, // +4 for QTYPE + QCLASS
            None => return,
        }
    }

    // Update TTL in all resource records
    for _ in 0..total_rr {
        if pos >= response.len() {
            return;
        }

        // Skip name
        match skip_name(response, pos) {
            Some(p) => pos = p,
            None => return,
        }

        if pos + 10 > response.len() {
            return;
        }

        // Write remaining TTL at offset +4
        let ttl_bytes = remaining_secs.to_be_bytes();
        response[pos + 4] = ttl_bytes[0];
        response[pos + 5] = ttl_bytes[1];
        response[pos + 6] = ttl_bytes[2];
        response[pos + 7] = ttl_bytes[3];

        let rdlength = u16::from_be_bytes([response[pos + 8], response[pos + 9]]) as usize;
        pos += 10 + rdlength;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_min_ttl_empty() {
        let response = vec![0u8; 12]; // Header only, no answers
        assert_eq!(extract_min_ttl(&response), None);
    }

    #[test]
    fn test_extract_min_ttl_short() {
        let response = vec![0u8; 5];
        assert_eq!(extract_min_ttl(&response), None);
    }

    #[test]
    fn test_skip_name() {
        // Simple name: \x07example\x03com\x00
        let data = b"\x07example\x03com\x00";
        assert_eq!(skip_name(data, 0), Some(13));
    }

    #[test]
    fn test_skip_name_compression() {
        // Compression pointer: \xc0\x0c
        let data = b"\xc0\x0c";
        assert_eq!(skip_name(data, 0), Some(2));
    }

    #[tokio::test]
    async fn test_cache_insert_get() {
        let cache = DnsCache::new();

        // Build a minimal "response" (just enough bytes to have a header)
        let mut response = vec![0u8; 20];
        response[0] = 0xAB; // ID high
        response[1] = 0xCD; // ID low
        response[7] = 1; // ANCOUNT = 1

        cache.insert("example.com", 1, &response).await;

        // Query with different ID should get the response with updated ID
        let result = cache.get("example.com", 1, 0x1234).await;
        assert!(result.is_some());

        let cached = result.unwrap();
        assert_eq!(cached[0], 0x12); // Updated ID
        assert_eq!(cached[1], 0x34);
    }

    #[tokio::test]
    async fn test_cache_miss() {
        let cache = DnsCache::new();
        let result = cache.get("nonexistent.com", 1, 0x1234).await;
        assert!(result.is_none());
    }
}
