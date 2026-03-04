import UIKit
import Tauri
import WebKit

/// iOS VPN plugin for Tauri.
///
/// Bridges the iOS Network Extension framework (NEPacketTunnelProvider)
/// to the Rust WireGuard layer.
///
/// Requires:
/// - Apple Developer Program membership
/// - Network Extension entitlement
/// - App Group for IPC between the app and the tunnel extension
///
/// The main app sends VPN config to the PacketTunnelProvider via IPC,
/// the extension creates a utun device and starts the boringtun core.
class VpnPlugin: Plugin {

    /// Start the VPN tunnel.
    ///
    /// Configures and starts a NETunnelProviderManager session,
    /// which launches the PacketTunnelProvider extension.
    @objc public func startVpn(_ invoke: Invoke) throws {
        // iOS Network Extension not wired up yet, return an error for now
        invoke.resolve([
            "success": false,
            "tunFd": -1,
            "error": "iOS VPN requires Network Extension entitlement and NEPacketTunnelProvider."
        ])
    }

    /// Stop the VPN tunnel.
    @objc public func stopVpn(_ invoke: Invoke) throws {
        invoke.resolve([
            "success": true
        ])
    }

    /// Check if VPN permission/configuration is set up.
    @objc public func checkVpnPermission(_ invoke: Invoke) throws {
        // On iOS, VPN permission is managed through Settings > VPN
        invoke.resolve([
            "granted": false
        ])
    }
}
