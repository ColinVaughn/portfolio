package org.tunnely.client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log

/**
 * Android VpnService implementation for Tunnely.
 *
 * This service creates a TUN device via VpnService.Builder and makes the file descriptor
 * available to the Rust layer (via VpnPlugin) for WireGuard tunneling.
 *
 * ## Lifecycle
 * 1. [VpnPlugin.startVpn] starts this service and waits for [instance] to be set
 * 2. [VpnPlugin] calls [establishTunnel] synchronously with the VPN configuration
 * 3. [establishTunnel] configures and creates the TUN device, returning the fd
 * 4. The fd is returned to Rust which runs boringtun over it
 * 5. [VpnPlugin.stopVpn] calls [stopTunnel] to tear down the VPN session
 */
class TunnelVpnService : VpnService() {

    companion object {
        private const val TAG = "TunnelVpnService"
        private const val CHANNEL_ID = "tunnely_vpn"
        private const val NOTIFICATION_ID = 1

        /** Singleton reference so VpnPlugin can access the running service. */
        @Volatile
        var instance: TunnelVpnService? = null
            private set

        /** The active TUN interface. */
        @Volatile
        var tunInterface: ParcelFileDescriptor? = null
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        Log.i(TAG, "TunnelVpnService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Start as a foreground service with a persistent notification
        val notification = buildNotification("Tunnely VPN is connecting...")
        startForeground(NOTIFICATION_ID, notification)
        return START_STICKY
    }

    override fun onRevoke() {
        Log.i(TAG, "VPN revoked by system")
        stopTunnel()
        super.onRevoke()
    }

    override fun onDestroy() {
        stopTunnel()
        instance = null
        Log.i(TAG, "TunnelVpnService destroyed")
        super.onDestroy()
    }

    /**
     * Establish the VPN tunnel with the given configuration.
     * Called synchronously from VpnPlugin — no race condition.
     *
     * @param address   Client IP address (e.g. "10.0.0.2")
     * @param dns       DNS server addresses
     * @param mtu       TUN device MTU
     * @param endpoint  WireGuard server endpoint to exclude from VPN routing
     * @return The TUN file descriptor, or -1 on failure
     */
    fun establishTunnel(
        address: String,
        dns: List<String>,
        mtu: Int,
        endpoint: String
    ): Int {
        try {
            val builder = Builder()
                .setSession("Tunnely VPN")
                .setMtu(mtu)
                .addAddress(address, 32)
                .addRoute("0.0.0.0", 0)    // Route all IPv4 traffic
                .addRoute("::", 0)           // Route all IPv6 traffic

            // Add DNS servers
            for (dnsServer in dns) {
                val trimmed = dnsServer.trim()
                if (trimmed.isNotEmpty()) {
                    builder.addDnsServer(trimmed)
                }
            }

            // Exclude the VPN server endpoint from the tunnel to prevent routing loops
            if (endpoint.isNotEmpty()) {
                try {
                    val host = endpoint.substringBefore(":")
                    builder.addRoute(host, 32) // Direct route to server
                } catch (e: Exception) {
                    Log.w(TAG, "Could not parse server endpoint for exclusion: $endpoint", e)
                }
            }

            // Exclude our own app from the VPN to prevent loopback
            try {
                builder.addDisallowedApplication(packageName)
            } catch (e: Exception) {
                Log.w(TAG, "Could not disallow own app: $e")
            }

            val tun = builder.establish()
            if (tun == null) {
                Log.e(TAG, "VPN permission not granted — Builder.establish() returned null")
                return -1
            }

            tunInterface = tun
            val fd = tun.fd

            // Update notification to show connected state
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_ID, buildNotification("Tunnely VPN is connected"))

            Log.i(TAG, "VPN tunnel established, TUN fd=$fd, address=$address, mtu=$mtu")
            return fd
        } catch (e: Exception) {
            Log.e(TAG, "Failed to establish VPN tunnel", e)
            return -1
        }
    }

    /**
     * Stop the VPN tunnel and close the TUN device.
     */
    fun stopTunnel() {
        try {
            tunInterface?.close()
            tunInterface = null
            Log.i(TAG, "VPN tunnel stopped")
        } catch (e: Exception) {
            Log.w(TAG, "Error closing TUN interface: $e")
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Tunnely VPN",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "VPN connection status"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("Tunnely VPN")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }
}
