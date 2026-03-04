package org.tunnely.client

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Register the VPN plugin so Rust can call startVpn/stopVpn
    pluginManager.load(null, "vpn", VpnPlugin(this), "{}")
  }
}
