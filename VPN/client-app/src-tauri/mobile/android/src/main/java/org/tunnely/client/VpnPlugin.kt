package org.tunnely.client

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Tauri plugin that bridges the Android VPN service with the Rust layer.
 *
 * ## Commands
 * - `startVpn(config)` — Starts the VPN service, configures TUN, returns fd
 * - `stopVpn()` — Stops the VPN service and closes the TUN device
 * - `checkVpnPermission()` — Checks if VPN permission is granted
 *
 * ## Integration
 * This plugin is registered from Rust via `vpn_plugin::init()` which creates
 * a Tauri plugin with identifier "vpn". The Kotlin class is discovered by
 * Tauri's Android plugin system.
 */
@TauriPlugin
class VpnPlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        private const val TAG = "VpnPlugin"
        private const val VPN_PERMISSION_REQUEST_CODE = 24601
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Pending invoke waiting for VPN permission result
    private var pendingVpnInvoke: Invoke? = null
    private var pendingVpnConfig: JSObject? = null

    /**
     * Start the VPN service with the given configuration.
     *
     * Expected config JSON:
     * ```json
     * {
     *   "assignedIp": "10.0.0.2",
     *   "subnetMask": "255.255.255.255",
     *   "dnsServers": ["1.1.1.1", "8.8.8.8"],
     *   "mtu": 1420,
     *   "serverEndpoint": "203.0.113.1:51820",
     *   "sessionName": "Tunnely VPN"
     * }
     * ```
     */
    @Command
    fun startVpn(invoke: Invoke) {
        val config = invoke.getObject("config") ?: run {
            // Try reading arguments directly from the invoke args
            invoke.getObject("") ?: run {
                invoke.reject("Missing VPN configuration")
                return
            }
        }

        // Check VPN permission
        val vpnIntent = VpnService.prepare(activity)
        if (vpnIntent != null) {
            // Need to request permission — save pending state
            pendingVpnInvoke = invoke
            pendingVpnConfig = config
            activity.startActivityForResult(vpnIntent, VPN_PERMISSION_REQUEST_CODE)
            return
        }

        // Permission already granted — start VPN
        scope.launch {
            startVpnInner(invoke, config)
        }
    }

    /**
     * Stop the VPN service.
     */
    @Command
    fun stopVpn(invoke: Invoke) {
        scope.launch {
            try {
                val service = TunnelyVpnService.instance
                if (service != null) {
                    service.stopTunnel()
                    val ret = JSObject()
                    ret.put("success", true)
                    invoke.resolve(ret)
                } else {
                    val ret = JSObject()
                    ret.put("success", true) // Already stopped
                    invoke.resolve(ret)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop VPN", e)
                val ret = JSObject()
                ret.put("success", false)
                ret.put("error", e.message ?: "Unknown error")
                invoke.resolve(ret)
            }
        }
    }

    /**
     * Check if VPN permission is granted without prompting.
     */
    @Command
    fun checkVpnPermission(invoke: Invoke) {
        val vpnIntent = VpnService.prepare(activity)
        val ret = JSObject()
        ret.put("granted", vpnIntent == null)
        invoke.resolve(ret)
    }

    /**
     * Handle the VPN permission result from the activity.
     */
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == VPN_PERMISSION_REQUEST_CODE) {
            val invoke = pendingVpnInvoke
            val config = pendingVpnConfig
            pendingVpnInvoke = null
            pendingVpnConfig = null

            if (invoke == null || config == null) {
                Log.w(TAG, "VPN permission result but no pending invoke")
                return
            }

            if (resultCode == Activity.RESULT_OK) {
                scope.launch {
                    startVpnInner(invoke, config)
                }
            } else {
                val ret = JSObject()
                ret.put("success", false)
                ret.put("tunFd", -1)
                ret.put("error", "VPN permission denied by user")
                invoke.resolve(ret)
            }
        }
    }

    /**
     * Internal: Actually start the VPN service and return the TUN fd.
     */
    private fun startVpnInner(invoke: Invoke, config: JSObject) {
        try {
            // Start the VPN service
            val serviceIntent = Intent(activity, TunnelyVpnService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                activity.startForegroundService(serviceIntent)
            } else {
                activity.startService(serviceIntent)
            }

            // Wait briefly for the service to initialize
            Thread.sleep(500)

            val service = TunnelyVpnService.instance
            if (service == null) {
                val ret = JSObject()
                ret.put("success", false)
                ret.put("tunFd", -1)
                ret.put("error", "VPN service failed to start")
                invoke.resolve(ret)
                return
            }

            // Parse config
            val assignedIp = config.getString("assignedIp", "10.0.0.2")
            val mtu = config.getInteger("mtu", 1420)
            val serverEndpoint = config.getString("serverEndpoint", "")

            val dnsServers = mutableListOf<String>()
            try {
                val dnsArray = config.getJSONArray("dnsServers")
                for (i in 0 until dnsArray.length()) {
                    dnsServers.add(dnsArray.getString(i))
                }
            } catch (e: Exception) {
                // Default DNS if parsing fails
                dnsServers.add("1.1.1.1")
                dnsServers.add("8.8.8.8")
            }

            // Establish the tunnel
            val fd = service.establishTunnel(
                address = assignedIp,
                dns = dnsServers,
                mtu = mtu,
                endpoint = serverEndpoint
            )

            val ret = JSObject()
            if (fd >= 0) {
                ret.put("success", true)
                ret.put("tunFd", fd.toLong())
                Log.i(TAG, "VPN started, TUN fd=$fd")
            } else {
                ret.put("success", false)
                ret.put("tunFd", -1)
                ret.put("error", "Failed to establish TUN device — VPN permission may not be granted")
            }
            invoke.resolve(ret)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start VPN service", e)
            val ret = JSObject()
            ret.put("success", false)
            ret.put("tunFd", -1)
            ret.put("error", e.message ?: "Unknown error starting VPN")
            invoke.resolve(ret)
        }
    }
}
