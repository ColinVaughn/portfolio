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
 * Android VPN Service for Tunnely.
 *
 * This service creates a TUN device via the Android VPN framework and returns
 * the file descriptor to the Rust layer (via [VpnPlugin]) where boringtun
 * handles WireGuard encryption/decryption.
 *
 * ## Lifecycle
 * 1. [VpnPlugin.startVpn] is called from Rust with VPN configuration
 * 2. This service checks for VPN permission (or prompts the user)
 * 3. [VpnService.Builder] configures the TUN device (address, DNS, routes)
 * 4. [Builder.establish] returns a [ParcelFileDescriptor]
 * 5. The fd is returned to Rust which runs boringtun over it
 * 6. [VpnPlugin.stopVpn] tears down the VPN session
 */
class TunnelyVpnService : VpnService() {

    companion object {
        private const val TAG = "TunnelyVpnService"
        private const val NOTIFICATION_CHANNEL_ID = "tunnely_vpn_channel"
        private const val NOTIFICATION_ID = 1

        // Singleton reference so the plugin can access the running service
        @Volatile
        var instance: TunnelyVpnService? = null
            private set

        // The active TUN interface
        @Volatile
        var tunInterface: ParcelFileDescriptor? = null
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        Log.i(TAG, "TunnelyVpnService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Start as a foreground service with a persistent notification
        val notification = buildNotification("Tunnely VPN is connecting...")
        startForeground(NOTIFICATION_ID, notification)
        return START_STICKY
    }

    override fun onDestroy() {
        stopTunnel()
        instance = null
        Log.i(TAG, "TunnelyVpnService destroyed")
        super.onDestroy()
    }

    /**
     * Establish the VPN tunnel with the given configuration.
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
                .addRoute("0.0.0.0", 0)  // Route all IPv4 traffic

            // Add DNS servers
            for (dnsServer in dns) {
                val trimmed = dnsServer.trim()
                if (trimmed.isNotEmpty()) {
                    builder.addDnsServer(trimmed)
                }
            }

            // Exclude the WireGuard server endpoint from VPN routing
            // to prevent routing loops
            if (endpoint.isNotEmpty()) {
                try {
                    val host = endpoint.split(":")[0]
                    builder.addRoute(host, 32) // Direct route to server
                } catch (e: Exception) {
                    Log.w(TAG, "Could not parse server endpoint for exclusion: $endpoint", e)
                }
            }

            // Disallow the app itself from using the VPN to prevent loops
            try {
                builder.addDisallowedApplication(packageName)
            } catch (e: Exception) {
                Log.w(TAG, "Could not disallow own package", e)
            }

            // Establish the TUN device
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
            Log.w(TAG, "Error closing TUN interface", e)
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Tunnely VPN",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when Tunnely VPN is active"
                setShowBadge(false)
            }
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setContentTitle("Tunnely VPN")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("Tunnely VPN")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setOngoing(true)
                .build()
        }
    }
}
