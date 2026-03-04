package org.tunnely.client

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.util.Log
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class VpnConfigArgs {
    var assignedIp: String = ""
    var subnetMask: String = "255.255.255.255"
    var dnsServers: ArrayList<String> = arrayListOf()
    var mtu: Int = 1420
    var serverEndpoint: String = ""
    var sessionName: String = "Tunnely VPN"
}

/**
 * Tauri plugin that bridges native Android VPN APIs to Rust.
 *
 * Rust calls `run_mobile_plugin("vpn", "startVpn", config)` which invokes
 * [startVpn]. The native side starts [TunnelVpnService], which creates a
 * TUN device and returns the file descriptor back to Rust.
 */
@TauriPlugin
class VpnPlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        private const val TAG = "VpnPlugin"
    }

    private var pendingConfig: VpnConfigArgs? = null

    @Command
    fun startVpn(invoke: Invoke) {
        val config = invoke.parseArgs(VpnConfigArgs::class.java)

        // Check if VPN permission is already granted
        val prepareIntent = VpnService.prepare(activity)
        if (prepareIntent != null) {
            // Need to request VPN permission from the user
            pendingConfig = config
            startActivityForResult(invoke, prepareIntent, "onVpnPrepareResult")
            return
        }

        // Permission already granted, start the VPN
        doStartVpn(invoke, config)
    }

    @Command
    fun stopVpn(invoke: Invoke) {
        try {
            val service = TunnelVpnService.instance
            if (service != null) {
                service.stopTunnel()
            } else {
                // Service not running, stop it via intent as fallback
                val stopIntent = Intent(activity, TunnelVpnService::class.java)
                activity.stopService(stopIntent)
            }

            val ret = JSObject()
            ret.put("success", true)
            invoke.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop VPN: ${e.message}", e)
            val ret = JSObject()
            ret.put("success", false)
            ret.put("error", e.message ?: "Unknown error")
            invoke.resolve(ret)
        }
    }

    @ActivityCallback
    fun onVpnPrepareResult(invoke: Invoke, result: ActivityResult) {
        val config = pendingConfig
        pendingConfig = null

        if (config == null) {
            invoke.reject("Missing VPN config")
            return
        }

        if (result.resultCode == Activity.RESULT_OK) {
            doStartVpn(invoke, config)
        } else {
            val ret = JSObject()
            ret.put("tunFd", -1)
            ret.put("success", false)
            ret.put("error", "VPN permission denied by user")
            invoke.resolve(ret)
        }
    }

    private fun doStartVpn(invoke: Invoke, config: VpnConfigArgs) {
        try {
            // Start the VPN service (this triggers onCreate which sets instance)
            val intent = Intent(activity, TunnelVpnService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                activity.startForegroundService(intent)
            } else {
                activity.startService(intent)
            }

            // Wait for the service instance to become available
            // onCreate sets instance synchronously, but startService is async
            var service: TunnelVpnService? = null
            for (i in 0 until 20) { // Up to 2 seconds
                service = TunnelVpnService.instance
                if (service != null) break
                Thread.sleep(100)
            }

            if (service == null) {
                val ret = JSObject()
                ret.put("tunFd", -1)
                ret.put("success", false)
                ret.put("error", "VPN service failed to start (timeout waiting for service instance)")
                invoke.resolve(ret)
                return
            }

            // Parse DNS servers
            val dnsServers = if (config.dnsServers.isNotEmpty()) {
                config.dnsServers
            } else {
                arrayListOf("1.1.1.1", "8.8.8.8")
            }

            // Establish the tunnel synchronously — no race condition
            val fd = service.establishTunnel(
                address = config.assignedIp,
                dns = dnsServers,
                mtu = config.mtu,
                endpoint = config.serverEndpoint
            )

            val ret = JSObject()
            if (fd >= 0) {
                ret.put("tunFd", fd.toLong())
                ret.put("success", true)
                Log.i(TAG, "VPN started, TUN fd=$fd")
            } else {
                ret.put("tunFd", -1)
                ret.put("success", false)
                ret.put("error", "Failed to establish TUN device")
            }
            invoke.resolve(ret)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start VPN: ${e.message}", e)
            val ret = JSObject()
            ret.put("tunFd", -1)
            ret.put("success", false)
            ret.put("error", e.message ?: "Unknown error")
            invoke.resolve(ret)
        }
    }
}
