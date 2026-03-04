use anyhow::Result;
use std::process::Command;

/// Blocks QUIC/HTTP3 traffic by adding OS firewall rules to drop outbound UDP:443.
///
/// When QUIC is blocked, browsers automatically fall back to HTTP/2 over TCP,
/// which passes through the MITM proxy for ad filtering. This adds ~5-10ms
/// first-connection latency but ensures all HTTPS traffic is interceptable.
///
/// Implements `Drop` to ensure firewall rules are cleaned up even on crash.
pub struct QuicBlocker {
    /// Whether the QUIC blocker is currently active
    active: bool,
}

impl QuicBlocker {
    /// Create a new inactive QuicBlocker.
    pub fn new() -> Self {
        Self { active: false }
    }

    /// Enable QUIC blocking by adding a firewall rule to drop outbound UDP:443.
    pub fn enable(&mut self) -> Result<()> {
        if self.active {
            tracing::debug!("QUIC blocker already active");
            return Ok(());
        }

        #[cfg(target_os = "windows")]
        {
            self.enable_windows()?;
        }

        #[cfg(target_os = "macos")]
        {
            self.enable_macos()?;
        }

        #[cfg(target_os = "linux")]
        {
            self.enable_linux()?;
        }

        self.active = true;
        tracing::info!("QUIC/HTTP3 blocking enabled (UDP:443 drop rule added)");
        Ok(())
    }

    /// Disable QUIC blocking by removing the firewall rule.
    pub fn disable(&mut self) -> Result<()> {
        if !self.active {
            return Ok(());
        }

        #[cfg(target_os = "windows")]
        {
            self.disable_windows()?;
        }

        #[cfg(target_os = "macos")]
        {
            self.disable_macos()?;
        }

        #[cfg(target_os = "linux")]
        {
            self.disable_linux()?;
        }

        self.active = false;
        tracing::info!("QUIC/HTTP3 blocking disabled (UDP:443 drop rule removed)");
        Ok(())
    }

    /// Check if the QUIC blocker is currently active.
    #[allow(dead_code)]
    pub fn is_active(&self) -> bool {
        self.active
    }

    // ── Windows ──────────────────────────────────────────────────────────

    #[cfg(target_os = "windows")]
    fn enable_windows(&self) -> Result<()> {
        // Add Windows Firewall rule to block outbound UDP port 443
        let output = Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "add",
                "rule",
                "name=Tunnely-BlockQUIC",
                "dir=out",
                "action=block",
                "protocol=UDP",
                "remoteport=443",
                "profile=any",
            ])
            .output()
            .map_err(|e| anyhow::anyhow!("Failed to run netsh: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            // If rule already exists, that's fine
            if !stdout.contains("already exists") && !stderr.contains("already exists") {
                anyhow::bail!("Failed to add QUIC blocking rule: {stderr} {stdout}");
            }
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn disable_windows(&self) -> Result<()> {
        let output = Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "delete",
                "rule",
                "name=Tunnely-BlockQUIC",
            ])
            .output()
            .map_err(|e| anyhow::anyhow!("Failed to run netsh: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // If rule doesn't exist, that's fine (already cleaned up)
            if !stderr.contains("No rules") && !stderr.contains("not found") {
                tracing::warn!(error = %stderr, "Failed to remove QUIC blocking rule");
            }
        }

        Ok(())
    }

    // ── macOS ────────────────────────────────────────────────────────────

    #[cfg(target_os = "macos")]
    fn enable_macos(&self) -> Result<()> {
        // Get existing PF rules, append our QUIC block rule, and reload
        let anchor_rule = "block out proto udp from any to any port 443\n";
        let anchor_path = "/etc/pf.anchors/tunnely-quic";

        // Write the anchor file
        std::fs::write(anchor_path, anchor_rule)
            .map_err(|e| anyhow::anyhow!("Failed to write PF anchor: {e}"))?;

        // Add anchor to pf.conf if not already present
        let pf_conf = std::fs::read_to_string("/etc/pf.conf").unwrap_or_default();
        let anchor_line = "anchor \"tunnely-quic\"";
        let load_line = "load anchor \"tunnely-quic\" from \"/etc/pf.anchors/tunnely-quic\"";

        if !pf_conf.contains(anchor_line) {
            let mut new_conf = pf_conf.clone();
            new_conf.push_str(&format!("\n{anchor_line}\n{load_line}\n"));
            std::fs::write("/etc/pf.conf", &new_conf)
                .map_err(|e| anyhow::anyhow!("Failed to update pf.conf: {e}"))?;
        }

        // Reload PF rules
        let output = Command::new("pfctl")
            .args(["-f", "/etc/pf.conf"])
            .output()
            .map_err(|e| anyhow::anyhow!("Failed to reload PF rules: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::warn!(error = %stderr, "pfctl reload warning (may be non-fatal)");
        }

        // Enable PF if not already enabled
        let _ = Command::new("pfctl").args(["-e"]).output();

        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn disable_macos(&self) -> Result<()> {
        let anchor_path = "/etc/pf.anchors/tunnely-quic";

        // Remove the anchor file
        let _ = std::fs::remove_file(anchor_path);

        // Remove anchor lines from pf.conf
        if let Ok(pf_conf) = std::fs::read_to_string("/etc/pf.conf") {
            let cleaned: Vec<&str> = pf_conf
                .lines()
                .filter(|line| !line.contains("tunnely-quic"))
                .collect();

            let _ = std::fs::write("/etc/pf.conf", cleaned.join("\n") + "\n");
        }

        // Reload PF rules
        let _ = Command::new("pfctl").args(["-f", "/etc/pf.conf"]).output();

        Ok(())
    }

    // ── Linux ────────────────────────────────────────────────────────────

    #[cfg(target_os = "linux")]
    fn enable_linux(&self) -> Result<()> {
        let output = Command::new("iptables")
            .args([
                "-A",
                "OUTPUT",
                "-p",
                "udp",
                "--dport",
                "443",
                "-j",
                "DROP",
                "-m",
                "comment",
                "--comment",
                "Tunnely-BlockQUIC",
            ])
            .output()
            .map_err(|e| anyhow::anyhow!("Failed to run iptables: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to add iptables QUIC block rule: {stderr}");
        }

        // Also add ip6tables rule for IPv6
        let output6 = Command::new("ip6tables")
            .args([
                "-A",
                "OUTPUT",
                "-p",
                "udp",
                "--dport",
                "443",
                "-j",
                "DROP",
                "-m",
                "comment",
                "--comment",
                "Tunnely-BlockQUIC",
            ])
            .output();

        if let Err(e) = output6 {
            tracing::warn!(error = %e, "Could not add ip6tables QUIC rule (IPv6 may not be available)");
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    fn disable_linux(&self) -> Result<()> {
        // Remove the IPv4 rule
        let _ = Command::new("iptables")
            .args([
                "-D",
                "OUTPUT",
                "-p",
                "udp",
                "--dport",
                "443",
                "-j",
                "DROP",
                "-m",
                "comment",
                "--comment",
                "Tunnely-BlockQUIC",
            ])
            .output();

        // Remove the IPv6 rule
        let _ = Command::new("ip6tables")
            .args([
                "-D",
                "OUTPUT",
                "-p",
                "udp",
                "--dport",
                "443",
                "-j",
                "DROP",
                "-m",
                "comment",
                "--comment",
                "Tunnely-BlockQUIC",
            ])
            .output();

        Ok(())
    }
}

impl Drop for QuicBlocker {
    fn drop(&mut self) {
        if self.active {
            tracing::info!("QuicBlocker dropping  - removing QUIC block rules");
            if let Err(e) = self.disable() {
                tracing::error!(error = %e, "Failed to clean up QUIC block rules on drop");
            }
        }
    }
}
