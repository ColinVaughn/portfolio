use std::net::Ipv4Addr;

/// Cross-platform TUN device wrapper.
///
/// Uses `tun2` crate which supports:
/// - Windows (via Wintun driver)
/// - macOS (via utun)
/// - Linux (via /dev/net/tun)
pub struct TunDevice {
    inner: tun2::AsyncDevice,
}

impl TunDevice {
    pub async fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        use tokio::io::AsyncReadExt;
        self.inner.read(buf).await
    }

    pub async fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
        use tokio::io::AsyncWriteExt;
        self.inner.write_all(data).await
    }
}

/// Create a TUN device with the given assigned IP address.
pub fn create_tun_device(assigned_ip: Ipv4Addr, mtu: u16) -> anyhow::Result<TunDevice> {
    let mut config = tun2::Configuration::default();

    config
        .address(assigned_ip)
        .netmask((255, 255, 255, 255))
        .mtu(mtu) // 1420 for raw wg, 1404 for bonded wg
        .up();

    // Platform-specific name
    #[cfg(target_os = "linux")]
    config.name("tunnely0");

    #[cfg(target_os = "macos")]
    config.name("utun99");

    // Windows uses Wintun, name set automatically

    let device = tun2::create_as_async(&config)
        .map_err(|e| anyhow::anyhow!("Failed to create TUN device: {e}"))?;

    tracing::info!(%assigned_ip, "TUN device created");
    Ok(TunDevice { inner: device })
}

/// Set system DNS servers to route through the VPN.
pub async fn set_dns(dns_servers: &[String]) -> anyhow::Result<()> {
    if dns_servers.is_empty() {
        return Ok(());
    }

    let dns_list = dns_servers.join(",");

    #[cfg(target_os = "windows")]
    {
        // Use netsh to set DNS on the TUN interface
        for (i, dns) in dns_servers.iter().enumerate() {
            let cmd = if i == 0 {
                format!(
                    "netsh interface ip set dns name=\"tunnely0\" static {dns} primary"
                )
            } else {
                format!(
                    "netsh interface ip add dns name=\"tunnely0\" {dns} index={idx}",
                    idx = i + 1
                )
            };
            let output = tokio::process::Command::new("cmd")
                .args(["/C", &cmd])
                .output()
                .await?;
            if !output.status.success() {
                tracing::warn!("DNS set command failed: {}", String::from_utf8_lossy(&output.stderr));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = tokio::process::Command::new("networksetup")
            .args(["-setdnsservers", "Wi-Fi"])
            .args(dns_servers)
            .output()
            .await?;
        if !output.status.success() {
            tracing::warn!("DNS set failed: {}", String::from_utf8_lossy(&output.stderr));
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Use resolvectl if available (systemd-resolved)
        let output = tokio::process::Command::new("resolvectl")
            .args(["dns", "tunnely0"])
            .args(dns_servers)
            .output()
            .await;

        match output {
            Ok(o) if o.status.success() => {}
            _ => {
                // Fallback: write /etc/resolv.conf
                let content = dns_servers
                    .iter()
                    .map(|d| format!("nameserver {d}"))
                    .collect::<Vec<_>>()
                    .join("\n");
                tokio::fs::write("/etc/resolv.conf", content).await?;
            }
        }
    }

    tracing::info!(dns = %dns_list, "DNS servers configured");
    Ok(())
}

/// Restore DNS settings to system defaults.
pub async fn restore_dns() -> anyhow::Result<()> {
    #[cfg(target_os = "windows")]
    {
        let output = tokio::process::Command::new("cmd")
            .args(["/C", "netsh interface ip set dns name=\"tunnely0\" dhcp"])
            .output()
            .await?;
        if !output.status.success() {
            tracing::warn!("DNS restore failed: {}", String::from_utf8_lossy(&output.stderr));
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = tokio::process::Command::new("networksetup")
            .args(["-setdnsservers", "Wi-Fi", "empty"])
            .output()
            .await?;
        if !output.status.success() {
            tracing::warn!("DNS restore failed: {}", String::from_utf8_lossy(&output.stderr));
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Restart systemd-resolved to restore default DNS
        let _ = tokio::process::Command::new("systemctl")
            .args(["restart", "systemd-resolved"])
            .output()
            .await;
    }

    tracing::info!("DNS settings restored");
    Ok(())
}

/// Set system routes to direct all traffic through the VPN tunnel.
///
/// Uses the standard WireGuard split-route technique:
/// - Add 0.0.0.0/1  via TUN (covers 0.x.x.x - 127.x.x.x)
/// - Add 128.0.0.0/1 via TUN (covers 128.x.x.x - 255.x.x.x)
///   These two routes cover ALL IPs but are more specific than the
///   existing 0.0.0.0/0 default, so they take priority without deleting it.
/// - Add a host route for the VPN server IP via the ORIGINAL gateway
///   so encrypted WireGuard packets don't loop through the tunnel.
pub async fn set_routes(
    server_ip: std::net::Ipv4Addr,
    assigned_ip: std::net::Ipv4Addr,
) -> anyhow::Result<()> {
    #[cfg(target_os = "windows")]
    {
        // Find the Wintun interface index by looking for an interface with our assigned IP
        let if_output = tokio::process::Command::new("cmd")
            .args(["/C", &format!("netsh interface ipv4 show addresses | findstr /C:\"{}\"", assigned_ip)])
            .output()
            .await?;
        let if_text = String::from_utf8_lossy(&if_output.stdout);
        tracing::debug!(output = %if_text, "Searching for TUN interface");

        // Get interface index using PowerShell (more reliable)
        let ps_output = tokio::process::Command::new("powershell")
            .args(["-Command", &format!(
                "Get-NetIPAddress -IPAddress '{}' | Select-Object -ExpandProperty InterfaceIndex",
                assigned_ip
            )])
            .output()
            .await?;
        let if_index_str = String::from_utf8_lossy(&ps_output.stdout).trim().to_string();
        
        let if_index: u32 = match if_index_str.parse() {
            Ok(idx) => idx,
            Err(_) => {
                tracing::warn!(output = %if_index_str, "Could not determine TUN interface index, trying alternative");
                // Fallback: try to find by adapter name pattern
                let alt_output = tokio::process::Command::new("powershell")
                    .args(["-Command", "(Get-NetAdapter | Where-Object { $_.InterfaceDescription -match 'Wintun' }).ifIndex"])
                    .output()
                    .await?;
                let alt_str = String::from_utf8_lossy(&alt_output.stdout).trim().to_string();
                match alt_str.parse() {
                    Ok(idx) => idx,
                    Err(_) => {
                        tracing::error!("Cannot find Wintun interface index, VPN routing will not work");
                        return Ok(());
                    }
                }
            }
        };

        tracing::info!(if_index, "Wintun interface index found");

        // Find the original default gateway
        let gw_output = tokio::process::Command::new("powershell")
            .args(["-Command", "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1).NextHop"])
            .output()
            .await?;
        let gw = String::from_utf8_lossy(&gw_output.stdout).trim().to_string();

        if gw.is_empty() {
            tracing::warn!("Could not determine default gateway");
            return Ok(());
        }

        tracing::info!(gateway = %gw, "Original default gateway detected");

        // Exclusion route: VPN server IP via original gateway (so VPN packets don't loop)
        let _ = tokio::process::Command::new("cmd")
            .args(["/C", &format!("route add {} mask 255.255.255.255 {}", server_ip, gw)])
            .output()
            .await;

        // Split routes through TUN using IF parameter (critical for /32 netmask interfaces)
        let _ = tokio::process::Command::new("cmd")
            .args(["/C", &format!(
                "route add 0.0.0.0 mask 128.0.0.0 {} metric 5 IF {}",
                assigned_ip, if_index
            )])
            .output()
            .await;

        let _ = tokio::process::Command::new("cmd")
            .args(["/C", &format!(
                "route add 128.0.0.0 mask 128.0.0.0 {} metric 5 IF {}",
                assigned_ip, if_index
            )])
            .output()
            .await;

        tracing::info!(if_index, "Windows split routes added with IF parameter");
    }

    #[cfg(target_os = "macos")]
    {
        // Get original default gateway
        let gw_output = tokio::process::Command::new("route")
            .args(["-n", "get", "default"])
            .output()
            .await?;
        let gw_text = String::from_utf8_lossy(&gw_output.stdout);
        let gw = gw_text
            .lines()
            .find(|l| l.contains("gateway:"))
            .and_then(|l| l.split(':').nth(1))
            .map(|s| s.trim().to_string())
            .unwrap_or_default();

        if !gw.is_empty() {
            tracing::info!(gateway = %gw, "Original default gateway detected");
            let _ = tokio::process::Command::new("route")
                .args(["-n", "add", "-host", &server_ip.to_string(), &gw])
                .output()
                .await;
        }

        let _ = tokio::process::Command::new("route")
            .args(["-n", "add", "-net", "0.0.0.0/1", "-interface", "utun99"])
            .output()
            .await;

        let _ = tokio::process::Command::new("route")
            .args(["-n", "add", "-net", "128.0.0.0/1", "-interface", "utun99"])
            .output()
            .await;
    }

    #[cfg(target_os = "linux")]
    {
        let gw_output = tokio::process::Command::new("ip")
            .args(["route", "show", "default"])
            .output()
            .await?;
        let gw_text = String::from_utf8_lossy(&gw_output.stdout);
        let parts: Vec<&str> = gw_text.split_whitespace().collect();
        let gw = parts.get(2).map(|s| s.to_string()).unwrap_or_default();

        if !gw.is_empty() {
            tracing::info!(gateway = %gw, "Original default gateway detected");
            let _ = tokio::process::Command::new("ip")
                .args(["route", "add", &format!("{}/32", server_ip), "via", &gw])
                .output()
                .await;
        }

        let _ = tokio::process::Command::new("ip")
            .args(["route", "add", "0.0.0.0/1", "dev", "tunnely0"])
            .output()
            .await;

        let _ = tokio::process::Command::new("ip")
            .args(["route", "add", "128.0.0.0/1", "dev", "tunnely0"])
            .output()
            .await;
    }

    tracing::info!(%server_ip, "VPN routes configured");
    Ok(())
}

/// Remove VPN routes and restore original routing.
pub async fn restore_routes(server_ip: std::net::Ipv4Addr) -> anyhow::Result<()> {
    #[cfg(target_os = "windows")]
    {
        let _ = tokio::process::Command::new("cmd")
            .args(["/C", "route delete 0.0.0.0 mask 128.0.0.0"])
            .output()
            .await;
        let _ = tokio::process::Command::new("cmd")
            .args(["/C", "route delete 128.0.0.0 mask 128.0.0.0"])
            .output()
            .await;
        let _ = tokio::process::Command::new("cmd")
            .args(["/C", &format!("route delete {} mask 255.255.255.255", server_ip)])
            .output()
            .await;
    }

    #[cfg(target_os = "macos")]
    {
        let _ = tokio::process::Command::new("route")
            .args(["-n", "delete", "-net", "0.0.0.0/1"])
            .output()
            .await;
        let _ = tokio::process::Command::new("route")
            .args(["-n", "delete", "-net", "128.0.0.0/1"])
            .output()
            .await;
        let _ = tokio::process::Command::new("route")
            .args(["-n", "delete", "-host", &server_ip.to_string()])
            .output()
            .await;
    }

    #[cfg(target_os = "linux")]
    {
        let _ = tokio::process::Command::new("ip")
            .args(["route", "delete", "0.0.0.0/1", "dev", "tunnely0"])
            .output()
            .await;
        let _ = tokio::process::Command::new("ip")
            .args(["route", "delete", "128.0.0.0/1", "dev", "tunnely0"])
            .output()
            .await;
        let _ = tokio::process::Command::new("ip")
            .args(["route", "delete", &format!("{}/32", server_ip)])
            .output()
            .await;
    }

    tracing::info!(%server_ip, "VPN routes removed");
    Ok(())
}
