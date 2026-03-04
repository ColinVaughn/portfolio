use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::UdpSocket;
use tokio::sync::RwLock;

use super::stats;

/// Maximum number of CNAME hops to follow before giving up (prevents infinite loops).
const MAX_CNAME_HOPS: usize = 10;
/// Time-to-live for CNAME cache entries.
const CNAME_CACHE_TTL: Duration = Duration::from_secs(300); // 5 minutes
/// Maximum number of entries in the CNAME cache.
const MAX_CNAME_CACHE_ENTRIES: usize = 10_000;
/// DNS CNAME record type
const DNS_TYPE_CNAME: u16 = 5;

/// Cached CNAME resolution result
#[derive(Clone)]
struct CnameEntry {
    /// Whether any domain in the CNAME chain is blocked
    is_blocked: bool,
    /// The full CNAME chain (e.g., ["tracker.thirdparty.com", "cdn.tracking.net"])
    chain: Vec<String>,
    /// When this cache entry expires
    expires_at: Instant,
}

/// CNAME Uncloaker resolves CNAME chains and checks if any hop in the chain
/// points to a blocked domain. This defeats CNAME cloaking, where advertisers
/// set up first-party subdomains as CNAME aliases to third-party trackers.
///
/// Example: `analytics.yoursite.com` → CNAME → `tracker.thirdparty.com`
/// If `thirdparty.com` is in the blocklist, the CNAME-cloaked query is blocked.
pub struct CnameUncloaker {
    /// Upstream DNS resolver for CNAME lookups (bypasses our own filter)
    upstream: SocketAddr,
    /// Shared reference to the blocklist
    blocklist: Arc<RwLock<HashSet<Box<str>>>>,
    /// Cache of CNAME resolution results
    cache: Arc<RwLock<Vec<(String, CnameEntry)>>>,
}

impl CnameUncloaker {
    /// Create a new CnameUncloaker.
    pub fn new(upstream: SocketAddr, blocklist: Arc<RwLock<HashSet<Box<str>>>>) -> Self {
        Self {
            upstream,
            blocklist,
            cache: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Check if a domain is blocked via CNAME uncloaking.
    ///
    /// First checks the direct blocklist (fast path), then resolves the CNAME chain
    /// and checks if any hop is blocked.
    ///
    /// Returns true if the domain should be blocked.
    pub async fn is_blocked_via_cname(&self, domain: &str) -> bool {
        // Fast path: check if the domain itself is directly blocked
        {
            let bl = self.blocklist.read().await;
            if is_domain_in_blocklist(domain, &bl) {
                return true;
            }
        }

        // Check the cache
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache
                .iter()
                .find(|(d, _)| d == domain)
                .map(|(_, e)| e.clone())
            {
                if entry.expires_at > Instant::now() {
                    return entry.is_blocked;
                }
            }
        }

        // Resolve CNAME chain
        let chain = match self.resolve_cname_chain(domain).await {
            Ok(c) => c,
            Err(e) => {
                tracing::debug!(domain, error = %e, "CNAME resolution failed, allowing");
                return false;
            }
        };

        // If no CNAME chain, the domain stands on its own
        if chain.is_empty() {
            return false;
        }

        // Check if any domain in the CNAME chain is blocked
        let is_blocked = {
            let bl = self.blocklist.read().await;
            chain.iter().any(|cname| is_domain_in_blocklist(cname, &bl))
        };

        if is_blocked {
            stats::record_dns_cname_block();
            tracing::info!(
                domain,
                chain = ?chain,
                "Blocked CNAME-cloaked tracker"
            );
        }

        // Cache the result
        {
            let mut cache = self.cache.write().await;

            // Evict expired entries if cache is full
            if cache.len() >= MAX_CNAME_CACHE_ENTRIES {
                let now = Instant::now();
                cache.retain(|(_, entry)| entry.expires_at > now);

                // If still full after eviction, remove oldest entries
                if cache.len() >= MAX_CNAME_CACHE_ENTRIES {
                    let drain_count = cache.len() / 4; // Remove 25%
                    cache.drain(..drain_count);
                }
            }

            // Remove existing entry for this domain if present
            cache.retain(|(d, _)| d != domain);

            cache.push((
                domain.to_string(),
                CnameEntry {
                    is_blocked,
                    chain,
                    expires_at: Instant::now() + CNAME_CACHE_TTL,
                },
            ));
        }

        is_blocked
    }

    /// Resolve the CNAME chain for a domain by sending DNS queries upstream.
    /// Returns the list of CNAME targets in order.
    async fn resolve_cname_chain(&self, domain: &str) -> anyhow::Result<Vec<String>> {
        let mut chain = Vec::new();
        let mut current = domain.to_string();

        for _ in 0..MAX_CNAME_HOPS {
            let query = build_cname_query(&current);
            let socket = UdpSocket::bind("0.0.0.0:0").await?;
            socket.send_to(&query, self.upstream).await?;

            let mut buf = vec![0u8; 4096];
            let len =
                match tokio::time::timeout(Duration::from_secs(2), socket.recv(&mut buf)).await {
                    Ok(Ok(len)) => len,
                    Ok(Err(e)) => return Err(e.into()),
                    Err(_) => return Ok(chain), // Timeout  - return what we have
                };

            let response = &buf[..len];

            // Parse CNAME from the response
            match parse_cname_from_response(response) {
                Some(target) => {
                    let target_lower = target.to_lowercase();
                    // Cycle detection
                    if chain.contains(&target_lower) || target_lower == current {
                        break;
                    }
                    chain.push(target_lower.clone());
                    current = target_lower;
                }
                None => break, // No more CNAMEs
            }
        }

        Ok(chain)
    }
}

/// Build a DNS query for CNAME record type.
fn build_cname_query(domain: &str) -> Vec<u8> {
    let mut query = Vec::new();

    // Header: random ID, RD=1, QDCOUNT=1
    query.extend_from_slice(&[0xAB, 0xCD]); // ID
    query.extend_from_slice(&[0x01, 0x00]); // Flags: RD=1
    query.extend_from_slice(&[0x00, 0x01]); // QDCOUNT=1
    query.extend_from_slice(&[0x00, 0x00]); // ANCOUNT=0
    query.extend_from_slice(&[0x00, 0x00]); // NSCOUNT=0
    query.extend_from_slice(&[0x00, 0x00]); // ARCOUNT=0

    // Question: domain name
    for label in domain.split('.') {
        if label.is_empty() {
            continue;
        }
        query.push(label.len() as u8);
        query.extend_from_slice(label.as_bytes());
    }
    query.push(0x00); // End of domain name

    // QTYPE: CNAME (5)
    query.extend_from_slice(&DNS_TYPE_CNAME.to_be_bytes());
    // QCLASS: IN (1)
    query.extend_from_slice(&[0x00, 0x01]);

    query
}

/// Parse a CNAME target from a DNS response.
/// Returns the CNAME target domain if found, or None if there's no CNAME answer.
fn parse_cname_from_response(response: &[u8]) -> Option<String> {
    if response.len() < 12 {
        return None;
    }

    let ancount = u16::from_be_bytes([response[6], response[7]]);
    if ancount == 0 {
        return None;
    }

    // Skip the header (12 bytes) and question section
    let mut pos = 12;

    // Skip question section
    let qdcount = u16::from_be_bytes([response[4], response[5]]);
    for _ in 0..qdcount {
        pos = skip_dns_name(response, pos)?;
        pos += 4; // QTYPE + QCLASS
    }

    // Parse answer records
    for _ in 0..ancount {
        if pos >= response.len() {
            return None;
        }

        // Skip the name
        pos = skip_dns_name(response, pos)?;

        if pos + 10 > response.len() {
            return None;
        }

        let rtype = u16::from_be_bytes([response[pos], response[pos + 1]]);
        let rdlength = u16::from_be_bytes([response[pos + 8], response[pos + 9]]) as usize;
        pos += 10; // TYPE(2) + CLASS(2) + TTL(4) + RDLENGTH(2)

        if rtype == DNS_TYPE_CNAME {
            // Parse the CNAME target domain name from RDATA
            return parse_dns_name(response, pos);
        }

        pos += rdlength;
    }

    None
}

/// Skip a DNS name (handling compression pointers) and return the position after it.
fn skip_dns_name(data: &[u8], mut pos: usize) -> Option<usize> {
    loop {
        if pos >= data.len() {
            return None;
        }

        let label_len = data[pos] as usize;

        if label_len == 0 {
            return Some(pos + 1); // Null terminator
        }

        if label_len >= 0xC0 {
            // Compression pointer  - 2 bytes
            return Some(pos + 2);
        }

        pos += 1 + label_len;
    }
}

/// Parse a DNS domain name from a response, handling compression pointers.
fn parse_dns_name(data: &[u8], start: usize) -> Option<String> {
    let mut parts = Vec::new();
    let mut pos = start;
    let mut jumps = 0;

    loop {
        if pos >= data.len() || jumps > 10 {
            return None; // Prevent infinite loops
        }

        let label_len = data[pos] as usize;

        if label_len == 0 {
            break;
        }

        if label_len >= 0xC0 {
            // Compression pointer
            if pos + 1 >= data.len() {
                return None;
            }
            let offset = (((data[pos] as usize) & 0x3F) << 8) | (data[pos + 1] as usize);
            pos = offset;
            jumps += 1;
            continue;
        }

        pos += 1;
        if pos + label_len > data.len() {
            return None;
        }

        let label = std::str::from_utf8(&data[pos..pos + label_len]).ok()?;
        parts.push(label.to_lowercase());
        pos += label_len;
    }

    if parts.is_empty() {
        return None;
    }

    Some(parts.join("."))
}

/// Check if a domain (or any of its parent domains) is in the blocklist.
fn is_domain_in_blocklist(domain: &str, blocklist: &HashSet<Box<str>>) -> bool {
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
