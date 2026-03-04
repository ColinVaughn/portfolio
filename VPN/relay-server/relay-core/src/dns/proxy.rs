use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream, UdpSocket};
use tokio::sync::RwLock;

use super::blocklist::is_domain_blocked;
use super::cache::DnsCache;
use super::cname::CnameUncloaker;
use super::stats;

/// Maximum DNS message size for UDP (with EDNS0 support)
const MAX_UDP_DNS_SIZE: usize = 4096;
/// Maximum DNS message size for TCP
const MAX_TCP_DNS_SIZE: usize = 65535;
/// DNS header size in bytes
const DNS_HEADER_SIZE: usize = 12;
/// DNS response code: NXDOMAIN (Name Error)
const RCODE_NXDOMAIN: u8 = 3;
/// DNS response code: NOERROR
const RCODE_NOERROR: u8 = 0;

/// DNS Filter Proxy  - listens on a local address, intercepts DNS queries,
/// blocks domains in the blocklist with 0.0.0.0 responses, and forwards
/// everything else to upstream resolvers.
pub struct DnsProxy {
    /// Local address to listen on (e.g., "127.0.0.1:5353")
    listen_addr: SocketAddr,
    /// Upstream DNS resolvers to forward allowed queries to
    upstream_resolvers: Vec<SocketAddr>,
    /// Shared reference to the blocklist for domain lookups
    blocklist: Arc<RwLock<HashSet<Box<str>>>>,
    /// CNAME uncloaker for resolving CNAME chains
    cname_uncloaker: Arc<CnameUncloaker>,
    /// DNS response cache
    dns_cache: Arc<DnsCache>,
    /// Timeout for upstream DNS queries
    upstream_timeout: std::time::Duration,
}

impl DnsProxy {
    /// Create a new DnsProxy instance.
    pub fn new(
        listen_addr: SocketAddr,
        upstream_resolvers: Vec<SocketAddr>,
        blocklist: Arc<RwLock<HashSet<Box<str>>>>,
        cname_uncloaker: Arc<CnameUncloaker>,
        dns_cache: Arc<DnsCache>,
    ) -> Self {
        Self {
            listen_addr,
            upstream_resolvers,
            blocklist,
            cname_uncloaker,
            dns_cache,
            upstream_timeout: std::time::Duration::from_secs(5),
        }
    }

    /// Run the DNS proxy, listening on both UDP and TCP.
    pub async fn run(&self) -> anyhow::Result<()> {
        let udp_socket = UdpSocket::bind(self.listen_addr).await?;
        let tcp_listener = TcpListener::bind(self.listen_addr).await?;

        tracing::info!(
            addr = %self.listen_addr,
            "DNS filter proxy listening (UDP + TCP)"
        );

        stats::set_dns_filter_enabled(true);

        // Clone Arcs for the two tasks
        let udp_blocklist = self.blocklist.clone();
        let tcp_blocklist = self.blocklist.clone();
        let udp_upstreams = self.upstream_resolvers.clone();
        let tcp_upstreams = self.upstream_resolvers.clone();
        let udp_cname = self.cname_uncloaker.clone();
        let tcp_cname = self.cname_uncloaker.clone();
        let udp_cache = self.dns_cache.clone();
        let tcp_cache = self.dns_cache.clone();
        let timeout = self.upstream_timeout;

        // Spawn UDP handler and TCP handler concurrently
        let udp_handle = tokio::spawn(async move {
            Self::run_udp(
                udp_socket,
                udp_blocklist,
                udp_upstreams,
                udp_cname,
                udp_cache,
                timeout,
            )
            .await
        });

        let tcp_handle = tokio::spawn(async move {
            Self::run_tcp(
                tcp_listener,
                tcp_blocklist,
                tcp_upstreams,
                tcp_cname,
                tcp_cache,
                timeout,
            )
            .await
        });

        tokio::select! {
            result = udp_handle => {
                tracing::error!("UDP DNS proxy task exited");
                result??;
            }
            result = tcp_handle => {
                tracing::error!("TCP DNS proxy task exited");
                result??;
            }
        }

        Ok(())
    }

    /// UDP DNS handler loop
    async fn run_udp(
        socket: UdpSocket,
        blocklist: Arc<RwLock<HashSet<Box<str>>>>,
        upstreams: Vec<SocketAddr>,
        cname: Arc<CnameUncloaker>,
        cache: Arc<DnsCache>,
        timeout: std::time::Duration,
    ) -> anyhow::Result<()> {
        let socket = Arc::new(socket);
        let mut buf = vec![0u8; MAX_UDP_DNS_SIZE];

        loop {
            let (len, src) = socket.recv_from(&mut buf).await?;
            if len < DNS_HEADER_SIZE {
                stats::record_dns_parse_error();
                continue;
            }

            let query = buf[..len].to_vec();
            let blocklist = blocklist.clone();
            let upstreams = upstreams.clone();
            let socket = socket.clone();
            let cname = cname.clone();
            let cache = cache.clone();

            tokio::spawn(async move {
                stats::record_dns_query();

                let response =
                    process_query(&query, &blocklist, &upstreams, &cname, &cache, timeout).await;

                match response {
                    Ok(data) => {
                        if let Err(e) = socket.send_to(&data, src).await {
                            tracing::debug!(error = %e, "Failed to send DNS response");
                        }
                    }
                    Err(e) => {
                        tracing::debug!(error = %e, "DNS query processing failed");
                        // Send SERVFAIL response
                        if let Some(response) = build_servfail_response(&query) {
                            let _ = socket.send_to(&response, src).await;
                        }
                    }
                }
            });
        }
    }

    /// TCP DNS handler loop
    async fn run_tcp(
        listener: TcpListener,
        blocklist: Arc<RwLock<HashSet<Box<str>>>>,
        upstreams: Vec<SocketAddr>,
        cname: Arc<CnameUncloaker>,
        cache: Arc<DnsCache>,
        timeout: std::time::Duration,
    ) -> anyhow::Result<()> {
        loop {
            let (stream, _peer) = listener.accept().await?;
            let blocklist = blocklist.clone();
            let upstreams = upstreams.clone();
            let cname = cname.clone();
            let cache = cache.clone();

            tokio::spawn(async move {
                if let Err(e) =
                    handle_tcp_client(stream, &blocklist, &upstreams, &cname, &cache, timeout).await
                {
                    tracing::debug!(error = %e, "TCP DNS client handler error");
                }
            });
        }
    }
}

/// Handle a single TCP DNS client connection.
/// TCP DNS messages are prefixed with a 2-byte big-endian length.
async fn handle_tcp_client(
    mut stream: TcpStream,
    blocklist: &Arc<RwLock<HashSet<Box<str>>>>,
    upstreams: &[SocketAddr],
    cname: &Arc<CnameUncloaker>,
    cache: &Arc<DnsCache>,
    timeout: std::time::Duration,
) -> anyhow::Result<()> {
    // Read the 2-byte length prefix
    let mut len_buf = [0u8; 2];
    stream.read_exact(&mut len_buf).await?;
    let msg_len = u16::from_be_bytes(len_buf) as usize;

    if msg_len < DNS_HEADER_SIZE || msg_len > MAX_TCP_DNS_SIZE {
        stats::record_dns_parse_error();
        return Ok(());
    }

    // Read the DNS message
    let mut buf = vec![0u8; msg_len];
    stream.read_exact(&mut buf).await?;

    stats::record_dns_query();

    let response = process_query(&buf, blocklist, upstreams, cname, cache, timeout).await?;

    // Write response with 2-byte length prefix
    let resp_len = (response.len() as u16).to_be_bytes();
    stream.write_all(&resp_len).await?;
    stream.write_all(&response).await?;

    Ok(())
}

/// Process a DNS query: check the blocklist, and either return a blocked response
/// or forward to upstream.
async fn process_query(
    query: &[u8],
    blocklist: &Arc<RwLock<HashSet<Box<str>>>>,
    upstreams: &[SocketAddr],
    cname_uncloaker: &Arc<CnameUncloaker>,
    cache: &Arc<DnsCache>,
    timeout: std::time::Duration,
) -> anyhow::Result<Vec<u8>> {
    // Parse the domain name from the query
    let domain = match parse_query_domain(query) {
        Some(d) => d,
        None => {
            stats::record_dns_parse_error();
            // Can't parse? Forward as-is
            return forward_to_upstream(query, upstreams, timeout).await;
        }
    };

    let query_type = parse_query_type(query);

    // Check the blocklist (direct match)
    let direct_blocked = {
        let bl = blocklist.read().await;
        is_domain_blocked(&domain, &bl)
    };

    // If not directly blocked, check via CNAME uncloaking
    let blocked = if direct_blocked {
        true
    } else {
        cname_uncloaker.is_blocked_via_cname(&domain).await
    };

    if blocked {
        stats::record_dns_blocked();
        tracing::debug!(domain = domain.as_str(), "DNS query blocked");

        Ok(build_blocked_response(query, &domain, query_type))
    } else {
        stats::record_dns_allowed();

        // Check DNS response cache before forwarding to upstream
        let query_id = if query.len() >= 2 {
            u16::from_be_bytes([query[0], query[1]])
        } else {
            0
        };

        if let Some(cached_response) = cache.get(&domain, query_type, query_id).await {
            return Ok(cached_response);
        }

        // Forward to upstream and cache the response
        let response = forward_to_upstream(query, upstreams, timeout).await?;
        cache.insert(&domain, query_type, &response).await;
        Ok(response)
    }
}

/// Forward a DNS query to upstream resolvers and return the response.
/// Tries each resolver in order until one responds.
async fn forward_to_upstream(
    query: &[u8],
    upstreams: &[SocketAddr],
    timeout: std::time::Duration,
) -> anyhow::Result<Vec<u8>> {
    for upstream in upstreams {
        match forward_single_upstream(query, *upstream, timeout).await {
            Ok(response) => return Ok(response),
            Err(e) => {
                tracing::debug!(
                    upstream = %upstream,
                    error = %e,
                    "Upstream DNS resolver failed, trying next"
                );
                stats::record_dns_upstream_error();
            }
        }
    }

    anyhow::bail!("All upstream DNS resolvers failed")
}

/// Forward a DNS query to a single upstream resolver via UDP.
async fn forward_single_upstream(
    query: &[u8],
    upstream: SocketAddr,
    timeout: std::time::Duration,
) -> anyhow::Result<Vec<u8>> {
    let local_socket = UdpSocket::bind("0.0.0.0:0").await?;
    local_socket.send_to(query, upstream).await?;

    let mut buf = vec![0u8; MAX_UDP_DNS_SIZE];
    let len = tokio::time::timeout(timeout, local_socket.recv(&mut buf)).await??;

    Ok(buf[..len].to_vec())
}

/// Parse the queried domain name from the DNS query message.
/// Returns None if the query is malformed.
fn parse_query_domain(query: &[u8]) -> Option<String> {
    if query.len() < DNS_HEADER_SIZE + 1 {
        return None;
    }

    let mut parts = Vec::new();
    let mut pos = DNS_HEADER_SIZE; // Skip the 12-byte DNS header

    loop {
        if pos >= query.len() {
            return None;
        }

        let label_len = query[pos] as usize;
        pos += 1;

        // End of domain name
        if label_len == 0 {
            break;
        }

        // Compressed pointer (shouldn't appear in a query's question, but handle it)
        if label_len >= 0xC0 {
            return None; // Don't handle compressed labels in the question section
        }

        // Sanity check label length
        if label_len > 63 || pos + label_len > query.len() {
            return None;
        }

        let label = std::str::from_utf8(&query[pos..pos + label_len]).ok()?;
        parts.push(label.to_lowercase());
        pos += label_len;
    }

    if parts.is_empty() {
        return None;
    }

    Some(parts.join("."))
}

/// Parse the query type (A = 1, AAAA = 28, etc.) from the DNS question section.
fn parse_query_type(query: &[u8]) -> u16 {
    // Skip header and domain name to find the QTYPE field
    let mut pos = DNS_HEADER_SIZE;

    // Skip the domain name labels
    while pos < query.len() {
        let label_len = query[pos] as usize;
        pos += 1;
        if label_len == 0 {
            break;
        }
        if label_len >= 0xC0 {
            pos += 1; // Skip the second byte of the pointer
            break;
        }
        pos += label_len;
    }

    // QTYPE is the next 2 bytes
    if pos + 2 <= query.len() {
        u16::from_be_bytes([query[pos], query[pos + 1]])
    } else {
        0 // Unknown
    }
}

/// Build a DNS response that blocks the query.
/// For A queries (type 1): respond with 0.0.0.0
/// For AAAA queries (type 28): respond with ::
/// For other types: respond with NXDOMAIN
fn build_blocked_response(query: &[u8], _domain: &str, query_type: u16) -> Vec<u8> {
    let mut response = query.to_vec();
    if response.len() < DNS_HEADER_SIZE {
        return response;
    }

    // Set QR bit (response), RD bit preserved, RA set
    response[2] = (response[2] | 0x80) | 0x01; // QR=1, RD=1
    response[3] = 0x80; // RA=1, RCODE=NOERROR

    // For A records: answer with 0.0.0.0
    if query_type == 1 {
        response[3] = (response[3] & 0xF0) | RCODE_NOERROR;
        // Set ANCOUNT = 1
        response[6] = 0x00;
        response[7] = 0x01;
        // Set NSCOUNT = 0, ARCOUNT = 0
        response[8] = 0x00;
        response[9] = 0x00;
        response[10] = 0x00;
        response[11] = 0x00;

        // Skip question section (already in response)
        let question_end = find_question_end(query);

        // Truncate to just the header + question
        response.truncate(question_end);

        // Append answer: pointer to question name + A record with 0.0.0.0
        // Name pointer (compressed): points to offset 12 (start of question name)
        response.push(0xC0);
        response.push(0x0C);
        // Type: A (1)
        response.push(0x00);
        response.push(0x01);
        // Class: IN (1)
        response.push(0x00);
        response.push(0x01);
        // TTL: 300 seconds (5 minutes)
        response.extend_from_slice(&300u32.to_be_bytes());
        // RDLENGTH: 4 bytes
        response.push(0x00);
        response.push(0x04);
        // RDATA: 0.0.0.0
        response.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);
    } else if query_type == 28 {
        // AAAA record: respond with ::
        response[3] = (response[3] & 0xF0) | RCODE_NOERROR;
        response[6] = 0x00;
        response[7] = 0x01;
        response[8] = 0x00;
        response[9] = 0x00;
        response[10] = 0x00;
        response[11] = 0x00;

        let question_end = find_question_end(query);
        response.truncate(question_end);

        // Name pointer
        response.push(0xC0);
        response.push(0x0C);
        // Type: AAAA (28)
        response.push(0x00);
        response.push(0x1C);
        // Class: IN (1)
        response.push(0x00);
        response.push(0x01);
        // TTL: 300 seconds
        response.extend_from_slice(&300u32.to_be_bytes());
        // RDLENGTH: 16 bytes
        response.push(0x00);
        response.push(0x10);
        // RDATA: :: (all zeros)
        response.extend_from_slice(&[0u8; 16]);
    } else {
        // For other query types: NXDOMAIN
        response[3] = (response[3] & 0xF0) | RCODE_NXDOMAIN;
        response[6] = 0x00;
        response[7] = 0x00;
        response[8] = 0x00;
        response[9] = 0x00;
        response[10] = 0x00;
        response[11] = 0x00;

        let question_end = find_question_end(query);
        response.truncate(question_end);
    }

    response
}

/// Build a SERVFAIL response from a query (used when upstream fails)
fn build_servfail_response(query: &[u8]) -> Option<Vec<u8>> {
    if query.len() < DNS_HEADER_SIZE {
        return None;
    }

    let mut response = query.to_vec();
    // Set QR bit (response)
    response[2] |= 0x80;
    // Set RCODE = SERVFAIL (2)
    response[3] = (response[3] & 0xF0) | 0x02;
    // Clear answer, authority, additional counts
    response[6] = 0x00;
    response[7] = 0x00;
    response[8] = 0x00;
    response[9] = 0x00;
    response[10] = 0x00;
    response[11] = 0x00;

    let question_end = find_question_end(query);
    response.truncate(question_end);

    Some(response)
}

/// Find the end of the question section in a DNS message.
fn find_question_end(query: &[u8]) -> usize {
    let qdcount = u16::from_be_bytes([query[4], query[5]]) as usize;
    let mut pos = DNS_HEADER_SIZE;

    for _ in 0..qdcount {
        // Skip domain name
        while pos < query.len() {
            let label_len = query[pos] as usize;
            pos += 1;
            if label_len == 0 {
                break;
            }
            if label_len >= 0xC0 {
                pos += 1;
                break;
            }
            pos += label_len;
        }
        // Skip QTYPE (2 bytes) + QCLASS (2 bytes)
        pos += 4;
    }

    pos.min(query.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a minimal DNS query for testing
    fn build_test_query(domain: &str, qtype: u16) -> Vec<u8> {
        let mut query = Vec::new();

        // Header: ID=0x1234, RD=1, QDCOUNT=1
        query.extend_from_slice(&[0x12, 0x34]); // ID
        query.extend_from_slice(&[0x01, 0x00]); // Flags: RD=1
        query.extend_from_slice(&[0x00, 0x01]); // QDCOUNT=1
        query.extend_from_slice(&[0x00, 0x00]); // ANCOUNT=0
        query.extend_from_slice(&[0x00, 0x00]); // NSCOUNT=0
        query.extend_from_slice(&[0x00, 0x00]); // ARCOUNT=0

        // Question: domain name
        for label in domain.split('.') {
            query.push(label.len() as u8);
            query.extend_from_slice(label.as_bytes());
        }
        query.push(0x00); // End of domain name

        // QTYPE
        query.extend_from_slice(&qtype.to_be_bytes());
        // QCLASS: IN (1)
        query.extend_from_slice(&[0x00, 0x01]);

        query
    }

    #[test]
    fn test_parse_query_domain() {
        let query = build_test_query("ads.example.com", 1);
        let domain = parse_query_domain(&query);
        assert_eq!(domain, Some("ads.example.com".to_string()));
    }

    #[test]
    fn test_parse_query_type() {
        let query_a = build_test_query("example.com", 1);
        assert_eq!(parse_query_type(&query_a), 1);

        let query_aaaa = build_test_query("example.com", 28);
        assert_eq!(parse_query_type(&query_aaaa), 28);
    }

    #[test]
    fn test_blocked_response_a_record() {
        let query = build_test_query("ads.example.com", 1);
        let response = build_blocked_response(&query, "ads.example.com", 1);

        // Check QR bit is set
        assert!(response[2] & 0x80 != 0);
        // Check RCODE is NOERROR
        assert_eq!(response[3] & 0x0F, RCODE_NOERROR);
        // Check ANCOUNT = 1
        assert_eq!(response[7], 1);
        // Check response ends with 0.0.0.0
        let last_four = &response[response.len() - 4..];
        assert_eq!(last_four, &[0x00, 0x00, 0x00, 0x00]);
    }

    #[test]
    fn test_blocked_response_aaaa_record() {
        let query = build_test_query("ads.example.com", 28);
        let response = build_blocked_response(&query, "ads.example.com", 28);

        // Check ANCOUNT = 1
        assert_eq!(response[7], 1);
        // Check response ends with 16 zero bytes (::)
        let last_sixteen = &response[response.len() - 16..];
        assert_eq!(last_sixteen, &[0u8; 16]);
    }

    #[test]
    fn test_blocked_response_nxdomain() {
        // TXT query
        let query = build_test_query("ads.example.com", 16);
        let response = build_blocked_response(&query, "ads.example.com", 16);

        // Check RCODE is NXDOMAIN
        assert_eq!(response[3] & 0x0F, RCODE_NXDOMAIN);
        // Check ANCOUNT = 0
        assert_eq!(response[7], 0);
    }

    #[test]
    fn test_servfail_response() {
        let query = build_test_query("example.com", 1);
        let response = build_servfail_response(&query).unwrap();

        // Check QR bit is set
        assert!(response[2] & 0x80 != 0);
        // Check RCODE is SERVFAIL (2)
        assert_eq!(response[3] & 0x0F, 2);
    }

    #[test]
    fn test_malformed_query() {
        // Too short
        let short = vec![0u8; 5];
        assert!(parse_query_domain(&short).is_none());
    }

    #[test]
    fn test_find_question_end() {
        let query = build_test_query("example.com", 1);
        let end = find_question_end(&query);
        // Header (12) + "example"(7+1) + "com"(3+1) + null(1) + QTYPE(2) + QCLASS(2) = 29
        assert_eq!(end, 29);
    }
}
