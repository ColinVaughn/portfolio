/// Tauri mobile VPN plugin.
///
/// This plugin bridges native mobile VPN APIs (Android VpnService / iOS
/// NEPacketTunnelProvider) to Rust. On desktop this module is not compiled.
///
/// ## Architecture
///
/// The commands layer calls `VpnPluginExt::vpn_start()` / `vpn_stop()` which
/// invokes the native Kotlin/Swift plugin class. The native side creates a TUN
/// device via the OS VPN API and returns the file descriptor. Rust then runs
/// `boringtun` over that fd for WireGuard tunneling.
use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "org.tunnely.client";

/// Configuration sent to the native VPN service when starting.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnConfig {
    /// The IP address assigned to this client by the relay server
    pub assigned_ip: String,
    /// Subnet mask (e.g. "255.255.255.255")
    pub subnet_mask: String,
    /// DNS servers to route through the VPN
    pub dns_servers: Vec<String>,
    /// MTU for the TUN device
    pub mtu: i32,
    /// WireGuard endpoint (relay server)  - excluded from VPN routing
    pub server_endpoint: String,
    /// Session display name
    pub session_name: String,
}

/// Response from the native VPN service after starting.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnStartResult {
    /// The TUN device file descriptor (Android) or handle identifier (iOS)
    pub tun_fd: i64,
    /// Whether the VPN service started successfully
    pub success: bool,
    /// Error message if `success` is false
    pub error: Option<String>,
}

/// Response from the native VPN service after stopping.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnStopResult {
    pub success: bool,
    pub error: Option<String>,
}

/// Stored VPN plugin state, managed via Tauri's state system.
pub struct VpnPluginState<R: Runtime> {
    handle: PluginHandle<R>,
}

/// Extension trait to easily access VPN plugin methods from any AppHandle.
pub trait VpnPluginExt<R: Runtime> {
    fn vpn_start(&self, config: &VpnConfig) -> Result<VpnStartResult, String>;
    fn vpn_stop(&self) -> Result<VpnStopResult, String>;
}

impl<R: Runtime> VpnPluginExt<R> for AppHandle<R> {
    fn vpn_start(&self, config: &VpnConfig) -> Result<VpnStartResult, String> {
        let state = self.try_state::<VpnPluginState<R>>()
            .ok_or_else(|| "VPN plugin not initialized".to_string())?;
        state.handle
            .run_mobile_plugin::<VpnStartResult>("startVpn", config)
            .map_err(|e| format!("Failed to start native VPN: {e}"))
    }

    fn vpn_stop(&self) -> Result<VpnStopResult, String> {
        let state = self.try_state::<VpnPluginState<R>>()
            .ok_or_else(|| "VPN plugin not initialized".to_string())?;
        state.handle
            .run_mobile_plugin::<VpnStopResult>("stopVpn", &())
            .map_err(|e| format!("Failed to stop native VPN: {e}"))
    }
}

/// Initialize the VPN plugin. Call this in `tauri::Builder::plugin()`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("vpn")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "VpnPlugin")?;
                app.manage(VpnPluginState { handle });
            }
            Ok(())
        })
        .build()
}
