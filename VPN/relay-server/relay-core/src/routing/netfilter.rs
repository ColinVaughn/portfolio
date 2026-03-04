use anyhow::Result;
use std::net::Ipv4Addr;
use std::process::Command;

/// Validate that a string is a safe IPv4 address (prevents command injection in nftables rules)
fn validate_ipv4(ip: &str) -> Result<()> {
    ip.parse::<Ipv4Addr>()
        .map_err(|_| anyhow::anyhow!("Invalid IPv4 address: {ip}"))?;
    Ok(())
}

/// Validate that a network interface name is safe (alphanumeric + hyphens only)
fn validate_interface_name(name: &str) -> Result<()> {
    if name.is_empty() || name.len() > 15 {
        anyhow::bail!("Invalid interface name length: {name}");
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        anyhow::bail!("Invalid characters in interface name: {name}");
    }
    Ok(())
}

/// Configure basic NAT masquerading for internet exit traffic
pub fn setup_nat_masquerade(wan_interface: &str) -> Result<()> {
    validate_interface_name(wan_interface)?;
    // Enable IP forwarding
    run_cmd("sysctl", &["-w", "net.ipv4.ip_forward=1"])?;

    // Set up nftables for NAT masquerade on exit traffic
    let nft_rules = format!(
        r#"
table inet relay_nat {{
    chain postrouting {{
        type nat hook postrouting priority srcnat; policy accept;
        # Masquerade traffic exiting to the internet
        oifname "{wan_interface}" masquerade
    }}

    chain prerouting {{
        type filter hook prerouting priority mangle; policy accept;
        # Packet marking rules added dynamically via add_forwarding_rule
    }}

    chain forward {{
        type filter hook forward priority filter; policy accept;
        # Allow forwarding for established connections
        ct state established,related accept
        # Allow forwarding from WireGuard interfaces
        iifname "wg-*" accept
    }}
}}
"#
    );

    // Apply nftables rules
    let mut child = Command::new("nft")
        .arg("-f")
        .arg("-")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| anyhow::anyhow!("Failed to spawn nft: {e}"))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        stdin.write_all(nft_rules.as_bytes())?;
    }

    let status = child.wait()?;
    if !status.success() {
        anyhow::bail!("nft command failed with status: {status}");
    }

    tracing::info!(wan = wan_interface, "NAT masquerade configured");

    Ok(())
}

/// Clean up NAT rules on shutdown
pub fn teardown_nat() -> Result<()> {
    run_cmd("nft", &["delete", "table", "inet", "relay_nat"])?;
    tracing::info!("NAT rules cleaned up");
    Ok(())
}

/// Set up nftables rules to redirect DNS queries from WireGuard clients
/// to the local DNS filter proxy.
///
/// Redirects both UDP and TCP port 53 traffic from wg-* interfaces
/// to the local DNS proxy port (default: 5353).
pub fn setup_dns_redirect(dns_proxy_port: u16) -> Result<()> {
    // Redirect UDP DNS (port 53) from WireGuard clients to local DNS proxy
    let udp_rule = format!(
        "add rule inet relay_nat prerouting iifname \"wg-*\" udp dport 53 redirect to :{}",
        dns_proxy_port
    );
    run_cmd("nft", &[&udp_rule])?;

    // Redirect TCP DNS (port 53) from WireGuard clients to local DNS proxy
    let tcp_rule = format!(
        "add rule inet relay_nat prerouting iifname \"wg-*\" tcp dport 53 redirect to :{}",
        dns_proxy_port
    );
    run_cmd("nft", &[&tcp_rule])?;

    tracing::info!(
        dns_proxy_port,
        "DNS redirect rules configured (UDP+TCP port 53 → local proxy)"
    );

    Ok(())
}

/// Remove DNS redirect rules on shutdown.
/// Uses a best-effort approach  - errors are logged but not propagated.
pub fn teardown_dns_redirect() -> Result<()> {
    // We delete specific rules by flushing the prerouting chain.
    // The NAT prerouting chain will be fully cleaned up when teardown_nat()
    // deletes the entire relay_nat table, so this is primarily for cases
    // where DNS filter shuts down before the full server shutdown.
    tracing::info!("DNS redirect rules will be cleaned up with NAT teardown");
    Ok(())
}

/// Add a policy routing rule for forwarding a client's traffic through the mesh
pub fn add_forwarding_rule(
    client_ip: &str,
    next_hop_mesh_ip: &str,
    fwmark: u32,
    table_id: u32,
) -> Result<()> {
    // Validate inputs to prevent command injection
    validate_ipv4(client_ip)?;
    validate_ipv4(next_hop_mesh_ip)?;

    // Mark packets from this client in prerouting (before routing decision)
    let mark_rule = format!(
        "add rule inet relay_nat prerouting ip saddr {} meta mark set 0x{:x}",
        client_ip, fwmark
    );
    run_cmd("nft", &[&mark_rule])?;

    // Add ip rule: fwmark -> routing table
    run_cmd(
        "ip",
        &[
            "rule",
            "add",
            "fwmark",
            &format!("0x{:x}", fwmark),
            "table",
            &table_id.to_string(),
        ],
    )?;

    // Add route in the table: default via next hop mesh IP
    run_cmd(
        "ip",
        &[
            "route",
            "add",
            "default",
            "via",
            next_hop_mesh_ip,
            "dev",
            "wg-mesh",
            "table",
            &table_id.to_string(),
        ],
    )?;

    tracing::info!(
        client_ip,
        next_hop = next_hop_mesh_ip,
        fwmark,
        table_id,
        "Forwarding rule added"
    );

    Ok(())
}

/// Remove a policy routing rule
pub fn remove_forwarding_rule(fwmark: u32, table_id: u32) -> Result<()> {
    // Remove ip rule
    let _ = run_cmd(
        "ip",
        &[
            "rule",
            "del",
            "fwmark",
            &format!("0x{:x}", fwmark),
            "table",
            &table_id.to_string(),
        ],
    );

    // Flush routing table
    let _ = run_cmd("ip", &["route", "flush", "table", &table_id.to_string()]);

    tracing::info!(fwmark, table_id, "Forwarding rule removed");

    Ok(())
}

/// Helper to run a system command
fn run_cmd(program: &str, args: &[&str]) -> Result<()> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to run {program}: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("{program} failed: {stderr}");
    }

    Ok(())
}

/// Set up nftables rules to block DNS-over-TLS (port 853) from WireGuard clients.
/// This forces DNS queries through the relay's filtered DNS proxy on port 53.
pub fn setup_dot_blocking() -> Result<()> {
    let rule = "add rule inet relay_nat forward iifname \"wg-*\" tcp dport 853 drop";
    run_cmd("nft", &[rule])?;
    tracing::info!("DNS-over-TLS (DoT) blocking enabled for WireGuard clients");
    Ok(())
}

/// Set up nftables rules to block DNS-over-HTTPS to known DoH provider IPs.
/// This prevents browsers from bypassing the relay DNS filter via DoH.
///
/// Note: We only block HTTPS (TCP:443) to known DoH provider IPs, not all HTTPS traffic.
/// This is surgical  - only DoH resolution is blocked, regular HTTPS still works.
pub fn setup_doh_blocking(provider_ips: &[String]) -> Result<()> {
    if provider_ips.is_empty() {
        tracing::warn!("No DoH provider IPs configured, skipping DoH blocking");
        return Ok(());
    }

    // Validate all IPs before applying any rules
    for ip in provider_ips {
        validate_ipv4(ip)?;
    }

    // Build a comma-separated IP set for nftables
    let ip_set = provider_ips.join(", ");

    // Block TCP:443 to known DoH providers from WireGuard clients
    let rule = format!(
        "add rule inet relay_nat forward iifname \"wg-*\" ip daddr {{ {} }} tcp dport 443 drop",
        ip_set
    );
    run_cmd("nft", &[&rule])?;

    tracing::info!(
        providers = provider_ips.len(),
        "DNS-over-HTTPS (DoH) blocking enabled for WireGuard clients"
    );

    Ok(())
}

/// Set up nftables rule to block QUIC/HTTP3 (UDP:443) from WireGuard clients.
/// This forces browsers to fall back to HTTP/2 over TCP, which allows the
/// client-side MITM proxy to inspect and filter the traffic.
pub fn setup_quic_blocking() -> Result<()> {
    let rule = "add rule inet relay_nat forward iifname \"wg-*\" udp dport 443 drop";
    run_cmd("nft", &[rule])?;
    tracing::info!("QUIC/HTTP3 blocking enabled for WireGuard clients (UDP:443 drop)");
    Ok(())
}
