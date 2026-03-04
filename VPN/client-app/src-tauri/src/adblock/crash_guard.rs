use anyhow::Result;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::task::JoinHandle;

/// Global flag set by our panic hook  - signals that a panic occurred
/// and cleanup should happen. This is checked by background tasks.
static PANIC_OCCURRED: AtomicBool = AtomicBool::new(false);

/// Default proxy address we configure (must match DEFAULT_PROXY_HOST:DEFAULT_PROXY_PORT in mod.rs)
const OUR_PROXY_HOST: &str = "127.0.0.1";
const OUR_PROXY_PORT: u16 = 9898;

/// How often the watchdog checks proxy health (seconds)
const WATCHDOG_INTERVAL_SECS: u64 = 30;

/// Install a global panic hook that attempts to clean up system proxy
/// and QUIC blocker rules before the process exits.
///
/// This is a best-effort safety net  - if the proxy crashes due to a panic,
/// we don't want to leave the user's system proxy pointing at a dead address
/// (which would break all internet access) or leave QUIC firewall rules active.
///
/// This should be called once during AdblockService initialization.
pub fn install_panic_hook() {
    let default_hook = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |info| {
        // Mark that a panic occurred
        PANIC_OCCURRED.store(true, Ordering::SeqCst);

        tracing::error!("Adblock system panic detected  - performing emergency cleanup");

        // Attempt to reset system proxy
        if let Err(e) = emergency_reset_system_proxy() {
            tracing::error!(error = %e, "Emergency system proxy reset failed");
        }

        // Attempt to remove QUIC blocker rules
        if let Err(e) = emergency_remove_quic_rules() {
            tracing::error!(error = %e, "Emergency QUIC rule removal failed");
        }

        // Call the default panic hook (prints the panic message)
        default_hook(info);
    }));

    tracing::info!("Adblock crash recovery panic hook installed");
}

/// Check for and clean up stale proxy settings from a previous crash.
///
/// On startup, we check if the system proxy is currently pointing to our address.
/// If it is and we're just starting up (proxy not running yet), that means we
/// crashed previously without cleaning up. We reset the proxy to restore connectivity.
///
/// This should be called in AdblockService::new() before the proxy starts.
pub fn cleanup_stale_proxy() -> Result<()> {
    let our_addr = format!("{}:{}", OUR_PROXY_HOST, OUR_PROXY_PORT);

    #[cfg(target_os = "windows")]
    {
        cleanup_stale_proxy_windows(&our_addr)?;
    }

    #[cfg(target_os = "macos")]
    {
        cleanup_stale_proxy_macos(&our_addr)?;
    }

    #[cfg(target_os = "linux")]
    {
        cleanup_stale_proxy_linux(&our_addr)?;
    }

    // Also check for stale QUIC blocker rules
    cleanup_stale_quic_rules();

    Ok(())
}

/// Spawn a watchdog task that monitors the proxy task health.
///
/// If the proxy task exits unexpectedly, the watchdog detects it and
/// disables the system proxy to restore connectivity. It also logs
/// the failure for diagnostics.
///
/// Returns the watchdog task handle.
pub fn spawn_watchdog(
    proxy_handle: Arc<tokio::sync::Mutex<Option<JoinHandle<()>>>>,
    system_proxy_enabled: Arc<AtomicBool>,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut consecutive_failures = 0u32;

        loop {
            tokio::time::sleep(Duration::from_secs(WATCHDOG_INTERVAL_SECS)).await;

            // Check if a panic occurred
            if PANIC_OCCURRED.load(Ordering::SeqCst) {
                tracing::error!("Watchdog: panic flag set, performing cleanup and exiting");
                break;
            }

            // Check proxy task health
            let handle = proxy_handle.lock().await;
            if let Some(h) = handle.as_ref() {
                if h.is_finished() {
                    consecutive_failures += 1;
                    tracing::error!(
                        consecutive_failures,
                        "Watchdog: proxy task has exited unexpectedly"
                    );

                    // Disable system proxy to restore connectivity
                    if system_proxy_enabled.load(Ordering::SeqCst) {
                        tracing::warn!("Watchdog: disabling system proxy due to proxy task failure");
                        if let Err(e) = emergency_reset_system_proxy() {
                            tracing::error!(error = %e, "Watchdog: failed to reset system proxy");
                        }
                        system_proxy_enabled.store(false, Ordering::SeqCst);
                    }

                    // Don't spam  - if we've seen 3+ failures, back off
                    if consecutive_failures >= 3 {
                        tracing::error!("Watchdog: too many proxy failures, stopping watchdog");
                        break;
                    }
                } else {
                    // Proxy is still running, reset failure counter
                    if consecutive_failures > 0 {
                        tracing::info!("Watchdog: proxy task recovered");
                    }
                    consecutive_failures = 0;
                }
            }
        }
    })
}

// ── Emergency cleanup functions ──────────────────────────────────────

/// Best-effort system proxy reset. Uses blocking I/O because this
/// runs in a panic hook where async is not available.
fn emergency_reset_system_proxy() -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                "/v", "ProxyEnable",
                "/t", "REG_DWORD",
                "/d", "0",
                "/f",
            ])
            .output();
        tracing::info!("Emergency: Windows proxy disabled via registry");
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // Try to disable proxy on common network services
        for service in &["Wi-Fi", "Ethernet"] {
            let _ = Command::new("networksetup")
                .args(["-setwebproxystate", service, "off"])
                .output();
            let _ = Command::new("networksetup")
                .args(["-setsecurewebproxystate", service, "off"])
                .output();
        }
        tracing::info!("Emergency: macOS proxy disabled");
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("gsettings")
            .args(["set", "org.gnome.system.proxy", "mode", "'none'"])
            .output();
        std::env::remove_var("http_proxy");
        std::env::remove_var("https_proxy");
        std::env::remove_var("HTTP_PROXY");
        std::env::remove_var("HTTPS_PROXY");
        tracing::info!("Emergency: Linux proxy disabled");
    }

    Ok(())
}

/// Best-effort QUIC blocker rule removal.
fn emergency_remove_quic_rules() -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("netsh")
            .args([
                "advfirewall", "firewall", "delete", "rule",
                "name=Tunnely-BlockQUIC",
            ])
            .output();
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::fs::remove_file("/etc/pf.anchors/tunnely-quic");
        let _ = std::process::Command::new("pfctl")
            .args(["-f", "/etc/pf.conf"])
            .output();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("iptables")
            .args(["-D", "OUTPUT", "-p", "udp", "--dport", "443", "-j", "DROP",
                   "-m", "comment", "--comment", "Tunnely-BlockQUIC"])
            .output();
        let _ = std::process::Command::new("ip6tables")
            .args(["-D", "OUTPUT", "-p", "udp", "--dport", "443", "-j", "DROP",
                   "-m", "comment", "--comment", "Tunnely-BlockQUIC"])
            .output();
    }

    Ok(())
}

// ── Stale proxy detection ────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn cleanup_stale_proxy_windows(our_addr: &str) -> Result<()> {
    use std::process::Command;

    // Read current proxy state from registry
    let output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "ProxyEnable",
        ])
        .output();

    let proxy_enabled = match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.contains("0x1")
        }
        Err(_) => false,
    };

    if !proxy_enabled {
        return Ok(());
    }

    // Check what the proxy server is set to
    let output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "ProxyServer",
        ])
        .output();

    let matches_ours = match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.contains(our_addr)
        }
        Err(_) => false,
    };

    if matches_ours {
        // System proxy points to our address  - check if proxy is actually listening
        if !is_port_in_use(OUR_PROXY_PORT) {
            tracing::warn!(
                addr = our_addr,
                "Detected stale system proxy from previous crash  - resetting"
            );
            let _ = Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                    "/v", "ProxyEnable",
                    "/t", "REG_DWORD",
                    "/d", "0",
                    "/f",
                ])
                .output();
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn cleanup_stale_proxy_macos(our_addr: &str) -> Result<()> {
    use std::process::Command;

    let parts: Vec<&str> = our_addr.split(':').collect();
    let host = parts[0];
    let port = parts.get(1).unwrap_or(&"9898");

    // Check Wi-Fi and Ethernet
    for service in &["Wi-Fi", "Ethernet"] {
        let output = Command::new("networksetup")
            .args(["-getwebproxy", service])
            .output();

        if let Ok(o) = output {
            let stdout = String::from_utf8_lossy(&o.stdout);
            if stdout.contains("Enabled: Yes")
                && stdout.contains(&format!("Server: {}", host))
                && stdout.contains(&format!("Port: {}", port))
            {
                if !is_port_in_use(OUR_PROXY_PORT) {
                    tracing::warn!(
                        service,
                        "Detected stale system proxy from previous crash  - resetting"
                    );
                    let _ = Command::new("networksetup")
                        .args(["-setwebproxystate", service, "off"])
                        .output();
                    let _ = Command::new("networksetup")
                        .args(["-setsecurewebproxystate", service, "off"])
                        .output();
                }
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "linux")]
fn cleanup_stale_proxy_linux(our_addr: &str) -> Result<()> {
    // Check if env vars or gsettings still point to our proxy
    if let Ok(proxy) = std::env::var("http_proxy") {
        if proxy.contains(our_addr) && !is_port_in_use(OUR_PROXY_PORT) {
            tracing::warn!(
                addr = our_addr,
                "Detected stale proxy environment variable from previous crash  - clearing"
            );
            std::env::remove_var("http_proxy");
            std::env::remove_var("https_proxy");
            std::env::remove_var("HTTP_PROXY");
            std::env::remove_var("HTTPS_PROXY");

            let _ = std::process::Command::new("gsettings")
                .args(["set", "org.gnome.system.proxy", "mode", "'none'"])
                .output();
        }
    }

    Ok(())
}

/// Check if a port is currently in use (i.e., something is listening on it).
fn is_port_in_use(port: u16) -> bool {
    std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

/// Best-effort cleanup of stale QUIC blocker rules from a previous crash.
fn cleanup_stale_quic_rules() {
    // We can't easily detect if QUIC rules are "stale" vs intentionally active,
    // but since QuicBlocker has a Drop trait, leftover rules likely indicate a crash.
    // We clean them up only if the QUIC blocker isn't currently supposed to be active.
    // Since this runs at startup before the blocker is enabled, any existing rules are stale.

    #[cfg(target_os = "windows")]
    {
        // Check if our firewall rule exists
        let output = std::process::Command::new("netsh")
            .args([
                "advfirewall", "firewall", "show", "rule",
                "name=Tunnely-BlockQUIC",
            ])
            .output();

        if let Ok(o) = output {
            let stdout = String::from_utf8_lossy(&o.stdout);
            if stdout.contains("Tunnely-BlockQUIC") {
                tracing::warn!("Found stale QUIC blocking rule from previous crash  - removing");
                let _ = std::process::Command::new("netsh")
                    .args([
                        "advfirewall", "firewall", "delete", "rule",
                        "name=Tunnely-BlockQUIC",
                    ])
                    .output();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if std::path::Path::new("/etc/pf.anchors/tunnely-quic").exists() {
            tracing::warn!("Found stale QUIC PF anchor from previous crash  - removing");
            let _ = std::fs::remove_file("/etc/pf.anchors/tunnely-quic");
            let _ = std::process::Command::new("pfctl")
                .args(["-f", "/etc/pf.conf"])
                .output();
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Check if our iptables rule exists by listing OUTPUT chain
        let output = std::process::Command::new("iptables")
            .args(["-L", "OUTPUT", "-n", "--line-numbers"])
            .output();

        if let Ok(o) = output {
            let stdout = String::from_utf8_lossy(&o.stdout);
            if stdout.contains("Tunnely-BlockQUIC") {
                tracing::warn!("Found stale QUIC iptables rule from previous crash  - removing");
                let _ = std::process::Command::new("iptables")
                    .args(["-D", "OUTPUT", "-p", "udp", "--dport", "443", "-j", "DROP",
                           "-m", "comment", "--comment", "Tunnely-BlockQUIC"])
                    .output();
                let _ = std::process::Command::new("ip6tables")
                    .args(["-D", "OUTPUT", "-p", "udp", "--dport", "443", "-j", "DROP",
                           "-m", "comment", "--comment", "Tunnely-BlockQUIC"])
                    .output();
            }
        }
    }
}
