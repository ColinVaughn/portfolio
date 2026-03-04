/// Minimal DNS packet parser and response synthesizer.
///
/// Parses just enough of the DNS protocol to:
/// 1. Extract the queried domain name from a DNS query packet
/// 2. Build a synthetic DNS response with A record = 0.0.0.0 for blocked domains
///
/// This avoids pulling in a full DNS library  - we only need basic query/response handling.
///
/// Reference: RFC 1035  - Domain Names - Implementation and Specification

/// A parsed DNS query.
#[derive(Debug, Clone)]
pub struct DnsQuery {
    /// Transaction ID (2 bytes, used to match response to query)
    pub id: u16,
    /// The queried domain name (e.g., "ads.google.com")
    pub domain: String,
    /// Query type (1 = A, 28 = AAAA, etc.)
    pub qtype: u16,
    /// Query class (1 = IN)
    pub qclass: u16,
    /// The raw question section bytes (for echoing back in response)
    pub question_bytes: Vec<u8>,
    /// Total length of the original query packet
    pub original_len: usize,
}

/// Parse a DNS query packet and extract the domain name.
///
/// Returns `None` if the packet is not a valid DNS query, is too short,
/// or is a response (QR bit set).
pub fn parse_dns_query(packet: &[u8]) -> Option<DnsQuery> {
    // DNS header is 12 bytes minimum
    if packet.len() < 12 {
        return None;
    }

    let id = u16::from_be_bytes([packet[0], packet[1]]);
    let flags = u16::from_be_bytes([packet[2], packet[3]]);

    // QR bit (bit 15) must be 0 for queries
    if flags & 0x8000 != 0 {
        return None;
    }

    let qdcount = u16::from_be_bytes([packet[4], packet[5]]);

    // We only handle single-question queries
    if qdcount != 1 {
        return None;
    }

    // Parse the question section (starts at byte 12)
    let question_start = 12;
    let (domain, question_end) = parse_domain_name(packet, question_start)?;

    // Need at least 4 more bytes for QTYPE + QCLASS
    if question_end + 4 > packet.len() {
        return None;
    }

    let qtype = u16::from_be_bytes([packet[question_end], packet[question_end + 1]]);
    let qclass = u16::from_be_bytes([packet[question_end + 2], packet[question_end + 3]]);

    let question_bytes = packet[question_start..question_end + 4].to_vec();

    Some(DnsQuery {
        id,
        domain,
        qtype,
        qclass,
        question_bytes,
        original_len: packet.len(),
    })
}

/// Parse a DNS domain name from a packet at the given offset.
///
/// Returns the domain name as a string and the byte offset after the name.
fn parse_domain_name(packet: &[u8], start: usize) -> Option<(String, usize)> {
    let mut labels = Vec::new();
    let mut pos = start;

    loop {
        if pos >= packet.len() {
            return None;
        }

        let len = packet[pos] as usize;

        // End of name (null label)
        if len == 0 {
            pos += 1;
            break;
        }

        // Compression pointer (first 2 bits are 11)
        if len & 0xC0 == 0xC0 {
            // We don't follow compression pointers for queries (rare in queries anyway)
            return None;
        }

        // Regular label
        if pos + 1 + len > packet.len() {
            return None;
        }

        let label = std::str::from_utf8(&packet[pos + 1..pos + 1 + len]).ok()?;
        labels.push(label.to_string());
        pos += 1 + len;

        // Safety: prevent infinite loops on malformed packets
        if labels.len() > 128 {
            return None;
        }
    }

    if labels.is_empty() {
        return None;
    }

    Some((labels.join(".").to_lowercase(), pos))
}

/// Synthesize a DNS response that resolves to 0.0.0.0 (for A queries)
/// or returns NXDOMAIN for other types.
///
/// This builds a minimal valid DNS response packet that:
/// - Echoes back the query ID and question section
/// - Sets QR=1 (response), AA=1 (authoritative), RA=1 (recursion available)
/// - Contains an A record (0.0.0.0) with a short TTL (60 seconds)
pub fn synthesize_blocked_response(query: &DnsQuery) -> Vec<u8> {
    // For A (type 1) queries, return 0.0.0.0
    // For AAAA (type 28) queries, return ::0
    // For other types, return NXDOMAIN

    let is_a_query = query.qtype == 1;
    let is_aaaa_query = query.qtype == 28;

    if !is_a_query && !is_aaaa_query {
        // Return NXDOMAIN (rcode=3) for non-A/AAAA queries
        return synthesize_nxdomain(query);
    }

    // Calculate response size
    let answer_rdata_len = if is_a_query { 4 } else { 16 }; // IPv4 or IPv6
    let answer_len = 2 + 2 + 2 + 4 + 2 + answer_rdata_len; // name_ptr + type + class + ttl + rdlen + rdata
    let response_len = 12 + query.question_bytes.len() + answer_len;

    let mut response = Vec::with_capacity(response_len);

    // Header (12 bytes)
    response.extend_from_slice(&query.id.to_be_bytes()); // Transaction ID
    response.extend_from_slice(&0x8180u16.to_be_bytes()); // Flags: QR=1, AA=0, RA=1, RCODE=0
    response.extend_from_slice(&1u16.to_be_bytes()); // QDCOUNT = 1
    response.extend_from_slice(&1u16.to_be_bytes()); // ANCOUNT = 1
    response.extend_from_slice(&0u16.to_be_bytes()); // NSCOUNT = 0
    response.extend_from_slice(&0u16.to_be_bytes()); // ARCOUNT = 0

    // Question section (echo back)
    response.extend_from_slice(&query.question_bytes);

    // Answer section
    // Name: pointer to question (compression pointer 0xC00C = offset 12)
    response.extend_from_slice(&0xC00Cu16.to_be_bytes());

    // Type
    response.extend_from_slice(&query.qtype.to_be_bytes());

    // Class (IN = 1)
    response.extend_from_slice(&1u16.to_be_bytes());

    // TTL (60 seconds  - short so it's refreshed if user disables adblock)
    response.extend_from_slice(&60u32.to_be_bytes());

    if is_a_query {
        // RDLENGTH = 4 (IPv4)
        response.extend_from_slice(&4u16.to_be_bytes());
        // RDATA = 0.0.0.0
        response.extend_from_slice(&[0, 0, 0, 0]);
    } else {
        // RDLENGTH = 16 (IPv6)
        response.extend_from_slice(&16u16.to_be_bytes());
        // RDATA = ::0 (all zeros)
        response.extend_from_slice(&[0u8; 16]);
    }

    response
}

/// Synthesize an NXDOMAIN response for unsupported query types.
fn synthesize_nxdomain(query: &DnsQuery) -> Vec<u8> {
    let response_len = 12 + query.question_bytes.len();
    let mut response = Vec::with_capacity(response_len);

    // Header
    response.extend_from_slice(&query.id.to_be_bytes()); // Transaction ID
    response.extend_from_slice(&0x8183u16.to_be_bytes()); // Flags: QR=1, RA=1, RCODE=3 (NXDOMAIN)
    response.extend_from_slice(&1u16.to_be_bytes()); // QDCOUNT = 1
    response.extend_from_slice(&0u16.to_be_bytes()); // ANCOUNT = 0
    response.extend_from_slice(&0u16.to_be_bytes()); // NSCOUNT = 0
    response.extend_from_slice(&0u16.to_be_bytes()); // ARCOUNT = 0

    // Question section (echo back)
    response.extend_from_slice(&query.question_bytes);

    response
}

/// Check if a raw IP packet is a DNS query (UDP port 53).
///
/// Parses the IPv4 header to check:
/// 1. IP version = 4, protocol = UDP (17)
/// 2. Destination port = 53
///
/// Returns the DNS payload slice if this is a DNS query.
pub fn extract_dns_from_ip_packet(packet: &[u8]) -> Option<&[u8]> {
    // Minimum IPv4 header (20) + UDP header (8) + DNS header (12) = 40
    if packet.len() < 40 {
        return None;
    }

    let version = (packet[0] >> 4) & 0x0F;
    if version != 4 {
        return None; // Only IPv4 for now
    }

    let ihl = (packet[0] & 0x0F) as usize * 4;
    let protocol = packet[9];

    // UDP = 17
    if protocol != 17 {
        return None;
    }

    if packet.len() < ihl + 8 {
        return None;
    }

    // UDP destination port
    let dst_port = u16::from_be_bytes([packet[ihl + 2], packet[ihl + 3]]);

    if dst_port != 53 {
        return None;
    }

    // DNS payload starts after UDP header (8 bytes)
    let dns_start = ihl + 8;
    if dns_start >= packet.len() {
        return None;
    }

    Some(&packet[dns_start..])
}

/// Wrap a DNS response payload into a UDP/IPv4 packet.
///
/// Uses the original query IP packet as a template  - swaps src/dst IP and port.
pub fn wrap_dns_response_in_ip(original_ip_packet: &[u8], dns_response: &[u8]) -> Option<Vec<u8>> {
    if original_ip_packet.len() < 28 {
        return None;
    }

    let ihl = (original_ip_packet[0] & 0x0F) as usize * 4;

    // Total IP packet size
    let udp_len = 8 + dns_response.len();
    let total_len = ihl + udp_len;

    let mut packet = vec![0u8; total_len];

    // Copy IP header from original, then modify
    packet[..ihl].copy_from_slice(&original_ip_packet[..ihl]);

    // Set total length
    let total_len_u16 = total_len as u16;
    packet[2..4].copy_from_slice(&total_len_u16.to_be_bytes());

    // Swap source and destination IP
    let src_ip = &original_ip_packet[12..16];
    let dst_ip = &original_ip_packet[16..20];
    packet[12..16].copy_from_slice(dst_ip);
    packet[16..20].copy_from_slice(src_ip);

    // Reset IP TTL to 64
    packet[8] = 64;

    // Clear IP checksum (will be recalculated)
    packet[10] = 0;
    packet[11] = 0;

    // Calculate IP header checksum
    let ip_checksum = calculate_checksum(&packet[..ihl]);
    packet[10..12].copy_from_slice(&ip_checksum.to_be_bytes());

    // UDP header
    let src_port = u16::from_be_bytes([original_ip_packet[ihl + 2], original_ip_packet[ihl + 3]]); // original dst
    let dst_port = u16::from_be_bytes([original_ip_packet[ihl], original_ip_packet[ihl + 1]]); // original src

    packet[ihl..ihl + 2].copy_from_slice(&src_port.to_be_bytes());
    packet[ihl + 2..ihl + 4].copy_from_slice(&dst_port.to_be_bytes());
    packet[ihl + 4..ihl + 6].copy_from_slice(&(udp_len as u16).to_be_bytes());
    // UDP checksum = 0 (optional for IPv4)
    packet[ihl + 6] = 0;
    packet[ihl + 7] = 0;

    // DNS response payload
    packet[ihl + 8..].copy_from_slice(dns_response);

    Some(packet)
}

/// Calculate the IP header checksum (RFC 1071).
fn calculate_checksum(data: &[u8]) -> u16 {
    if data.is_empty() {
        return 0;
    }

    let mut sum: u32 = 0;
    let mut i = 0;
    let len = data.len();

    while i < len - 1 {
        sum += u16::from_be_bytes([data[i], data[i + 1]]) as u32;
        i += 2;
    }

    if len % 2 != 0 {
        sum += (data[len - 1] as u32) << 8;
    }

    while sum >> 16 != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }

    !sum as u16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_dns_query() {
        // A minimal DNS query for "example.com" type A
        let mut packet = Vec::new();
        // Header
        packet.extend_from_slice(&[0xAB, 0xCD]); // ID
        packet.extend_from_slice(&[0x01, 0x00]); // Flags: standard query
        packet.extend_from_slice(&[0x00, 0x01]); // QDCOUNT = 1
        packet.extend_from_slice(&[0x00, 0x00]); // ANCOUNT = 0
        packet.extend_from_slice(&[0x00, 0x00]); // NSCOUNT = 0
        packet.extend_from_slice(&[0x00, 0x00]); // ARCOUNT = 0
                                                 // Question: example.com
        packet.push(7); // length of "example"
        packet.extend_from_slice(b"example");
        packet.push(3); // length of "com"
        packet.extend_from_slice(b"com");
        packet.push(0); // null terminator
        packet.extend_from_slice(&[0x00, 0x01]); // QTYPE = A
        packet.extend_from_slice(&[0x00, 0x01]); // QCLASS = IN

        let query = parse_dns_query(&packet).unwrap();
        assert_eq!(query.id, 0xABCD);
        assert_eq!(query.domain, "example.com");
        assert_eq!(query.qtype, 1);
        assert_eq!(query.qclass, 1);
    }

    #[test]
    fn test_parse_dns_response_rejected() {
        // A DNS response (QR bit set)
        let packet = [
            0xAB, 0xCD, 0x81, 0x80, // QR=1
            0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ];
        assert!(parse_dns_query(&packet).is_none());
    }

    #[test]
    fn test_synthesize_blocked_response() {
        let query = DnsQuery {
            id: 0x1234,
            domain: "ads.google.com".to_string(),
            qtype: 1,  // A
            qclass: 1, // IN
            question_bytes: vec![
                3, b'a', b'd', b's', 6, b'g', b'o', b'o', b'g', b'l', b'e', 3, b'c', b'o', b'm', 0,
                0, 1, 0, 1,
            ],
            original_len: 32,
        };

        let response = synthesize_blocked_response(&query);

        // Check header
        assert_eq!(response[0..2], [0x12, 0x34]); // ID echoed
        assert_eq!(response[2] & 0x80, 0x80); // QR=1 (response)
        assert_eq!(response[6..8], [0x00, 0x01]); // ANCOUNT=1

        // Check the response contains 0.0.0.0
        let rdata_end = response.len();
        assert_eq!(response[rdata_end - 4..], [0, 0, 0, 0]); // A = 0.0.0.0
    }
}
