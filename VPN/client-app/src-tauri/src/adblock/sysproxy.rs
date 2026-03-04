use anyhow::{Context, Result};

/// System proxy configuration manager.
/// Enables/disables system-wide proxy settings to route HTTP/HTTPS traffic
/// through the local MITM proxy.
pub struct SystemProxy {
    proxy_host: String,
    proxy_port: u16,
    enabled: bool,
}

impl SystemProxy {
    pub fn new(host: &str, port: u16) -> Self {
        Self {
            proxy_host: host.to_string(),
            proxy_port: port,
            enabled: false,
        }
    }

    /// Check if system proxy is currently enabled by this instance
    #[allow(dead_code)]
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Enable the system proxy to point to our local MITM proxy
    pub fn enable(&mut self) -> Result<()> {
        let addr = format!("{}:{}", self.proxy_host, self.proxy_port);

        #[cfg(target_os = "windows")]
        {
            self.enable_windows(&addr)?;
        }

        #[cfg(target_os = "macos")]
        {
            self.enable_macos(&addr)?;
        }

        #[cfg(target_os = "linux")]
        {
            self.enable_linux(&addr)?;
        }

        self.enabled = true;
        tracing::info!(addr = addr.as_str(), "System proxy enabled");
        Ok(())
    }

    /// Disable the system proxy (restore original settings)
    pub fn disable(&mut self) -> Result<()> {
        if !self.enabled {
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

        self.enabled = false;
        tracing::info!("System proxy disabled");
        Ok(())
    }

    // ========== Windows implementation ==========
    #[cfg(target_os = "windows")]
    fn enable_windows(&self, addr: &str) -> Result<()> {
        use std::process::Command;

        // Enable proxy via registry
        Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                "/v",
                "ProxyEnable",
                "/t",
                "REG_DWORD",
                "/d",
                "1",
                "/f",
            ])
            .output()
            .context("Failed to enable proxy in Windows registry")?;

        // Set proxy address
        Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                "/v",
                "ProxyServer",
                "/t",
                "REG_SZ",
                "/d",
                addr,
                "/f",
            ])
            .output()
            .context("Failed to set proxy server in Windows registry")?;

        // Set proxy override (bypass list)
        Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                "/v", "ProxyOverride",
                "/t", "REG_SZ",
                "/d", "localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;<local>",
                "/f",
            ])
            .output()
            .context("Failed to set proxy override in Windows registry")?;

        // Notify the system of the change
        self.notify_windows_proxy_change();

        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn disable_windows(&self) -> Result<()> {
        use std::process::Command;

        Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                "/v",
                "ProxyEnable",
                "/t",
                "REG_DWORD",
                "/d",
                "0",
                "/f",
            ])
            .output()
            .context("Failed to disable proxy in Windows registry")?;

        // Notify the system of the change
        self.notify_windows_proxy_change();

        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn notify_windows_proxy_change(&self) {
        // Use PowerShell to notify Internet Explorer / system of proxy setting changes
        let _ = std::process::Command::new("powershell")
            .args([
                "-Command",
                "[System.Net.WebRequest]::DefaultWebProxy = [System.Net.WebRequest]::GetSystemWebProxy()",
            ])
            .output();
    }

    // ========== macOS implementation ==========
    #[cfg(target_os = "macos")]
    fn enable_macos(&self, addr: &str) -> Result<()> {
        use std::process::Command;

        // Get the active network service name
        let service = self.get_macos_network_service()?;
        let parts: Vec<&str> = addr.split(':').collect();
        let host = parts[0];
        let port = parts.get(1).unwrap_or(&"8080");

        // Set HTTP proxy
        Command::new("networksetup")
            .args(["-setwebproxy", &service, host, port])
            .output()
            .context("Failed to set HTTP proxy on macOS")?;

        // Set HTTPS proxy
        Command::new("networksetup")
            .args(["-setsecurewebproxy", &service, host, port])
            .output()
            .context("Failed to set HTTPS proxy on macOS")?;

        // Enable HTTP proxy
        Command::new("networksetup")
            .args(["-setwebproxystate", &service, "on"])
            .output()
            .context("Failed to enable HTTP proxy on macOS")?;

        // Enable HTTPS proxy
        Command::new("networksetup")
            .args(["-setsecurewebproxystate", &service, "on"])
            .output()
            .context("Failed to enable HTTPS proxy on macOS")?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn disable_macos(&self) -> Result<()> {
        use std::process::Command;

        let service = self.get_macos_network_service()?;

        Command::new("networksetup")
            .args(["-setwebproxystate", &service, "off"])
            .output()
            .context("Failed to disable HTTP proxy on macOS")?;

        Command::new("networksetup")
            .args(["-setsecurewebproxystate", &service, "off"])
            .output()
            .context("Failed to disable HTTPS proxy on macOS")?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn get_macos_network_service(&self) -> Result<String> {
        let output = std::process::Command::new("networksetup")
            .args(["-listallnetworkservices"])
            .output()
            .context("Failed to list network services")?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        // Find Wi-Fi or Ethernet, skipping the first line (asterisk header)
        for line in stdout.lines().skip(1) {
            let line = line.trim();
            if line.starts_with('*') {
                continue; // Disabled service
            }
            if line.contains("Wi-Fi") || line.contains("Ethernet") || line.contains("USB") {
                return Ok(line.to_string());
            }
        }

        // Fallback: use the first non-header, non-disabled service
        for line in stdout.lines().skip(1) {
            let line = line.trim();
            if !line.starts_with('*') && !line.is_empty() {
                return Ok(line.to_string());
            }
        }

        anyhow::bail!("No active network service found on macOS")
    }

    // ========== Linux implementation ==========
    #[cfg(target_os = "linux")]
    fn enable_linux(&self, addr: &str) -> Result<()> {
        // Set environment variables for GNOME/system proxy
        let proxy_url = format!("http://{}", addr);

        // Try gsettings for GNOME desktop
        if let Ok(output) = std::process::Command::new("gsettings")
            .args(["set", "org.gnome.system.proxy", "mode", "'manual'"])
            .output()
        {
            if output.status.success() {
                let _ = std::process::Command::new("gsettings")
                    .args([
                        "set",
                        "org.gnome.system.proxy.http",
                        "host",
                        &self.proxy_host,
                    ])
                    .output();
                let _ = std::process::Command::new("gsettings")
                    .args([
                        "set",
                        "org.gnome.system.proxy.http",
                        "port",
                        &self.proxy_port.to_string(),
                    ])
                    .output();
                let _ = std::process::Command::new("gsettings")
                    .args([
                        "set",
                        "org.gnome.system.proxy.https",
                        "host",
                        &self.proxy_host,
                    ])
                    .output();
                let _ = std::process::Command::new("gsettings")
                    .args([
                        "set",
                        "org.gnome.system.proxy.https",
                        "port",
                        &self.proxy_port.to_string(),
                    ])
                    .output();
            }
        }

        // Also set environment variables (for CLI tools)
        std::env::set_var("http_proxy", &proxy_url);
        std::env::set_var("https_proxy", &proxy_url);
        std::env::set_var("HTTP_PROXY", &proxy_url);
        std::env::set_var("HTTPS_PROXY", &proxy_url);

        Ok(())
    }

    #[cfg(target_os = "linux")]
    fn disable_linux(&self) -> Result<()> {
        // Reset GNOME proxy settings
        let _ = std::process::Command::new("gsettings")
            .args(["set", "org.gnome.system.proxy", "mode", "'none'"])
            .output();

        // Clear environment variables
        std::env::remove_var("http_proxy");
        std::env::remove_var("https_proxy");
        std::env::remove_var("HTTP_PROXY");
        std::env::remove_var("HTTPS_PROXY");

        Ok(())
    }
}

impl Drop for SystemProxy {
    fn drop(&mut self) {
        if self.enabled {
            tracing::warn!(
                "SystemProxy dropped while still enabled  - restoring system proxy settings"
            );
            if let Err(e) = self.disable() {
                tracing::error!(error = %e, "Failed to restore system proxy settings on drop");
            }
        }
    }
}
