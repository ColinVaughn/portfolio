import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Channel Bonding Engine | Tunnely Docs",
  description: "Learn how Tunnely uses multi-path TCP/UDP failover and channel bonding to aggregate bandwidth and ensure session reliability across Wi-Fi and Cellular.",
  keywords: ["channel bonding", "bandwidth aggregation", "multi-path tcp", "vpn reliability", "combine wifi and cellular", "tunnely bonding"],
  openGraph: {
    title: "Channel Bonding Engine | Tunnely Docs",
    description: "Learn how Tunnely uses multi-path TCP/UDP failover and channel bonding to aggregate bandwidth and ensure session reliability across Wi-Fi and Cellular.",
    url: "/docs/channel-bonding",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely Channel Bonding",
    description: "Combine multiple internet connections for absolute reliability.",
  }
};

export default function ChannelBondingDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Channel <span className="text-primary">Bonding</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        A single internet connection is inherently fragile. Tunnely's Pro and Enterprise tiers unlock the Channel Bonding engine, allowing the routing daemon to simultaneously utilize every physical network interface available to your machine.
      </p>

      <h2>The Concept</h2>
      <p>
        Standard VPNs bind their encrypted tunnel to the operating system's default routing gateway (e.g., your primary Wi-Fi adapter). If that Wi-Fi connection drops packets, experiences high latency, or disconnects entirely, your VPN tunnel collapses. Your video call freezes, your secure session drops, and you wait for a reconnection.
      </p>
      <p>
        The Tunnely <code>relay-core</code> daemon solves this by aggressively binding to <strong>multiple</strong> system interfaces simultaneously (e.g., Wi-Fi, Ethernet, and a tethered 5G cellular connection).
      </p>

      <h2>Bonding Strategies</h2>
      <p>
        The daemon can be configured via <code>tunnely_prefs.json</code> (or the GUI) to utilize one of two distinct multi-path strategies:
      </p>

      <div className="space-y-8 mt-8">
        <div className="border border-white/[0.08] p-6 bg-[#0A0A0A]">
          <h3 className="text-primary uppercase tracking-widest text-sm font-bold m-0 mb-2">1. Performance (Speed) Mode</h3>
          <p className="text-sm text-text-dim m-0">
            The daemon load-balances outbound cryptographic packets <strong>across</strong> all available interfaces. If you have a 50Mbps Wi-Fi connection and a 100Mbps 5G connection, the daemon will stripe the packets across both to achieve closer to 150Mbps of aggregate throughput. Data is reassembled seamlessly at the Tunnely Entry node before being forwarded into the mesh.
          </p>
        </div>

        <div className="border border-white/[0.08] p-6 bg-[#0A0A0A]">
          <h3 className="text-primary uppercase tracking-widest text-sm font-bold m-0 mb-2">2. Reliability (Redundancy) Mode</h3>
          <p className="text-sm text-text-dim m-0">
            The daemon clones every outbound cryptographic packet and sends an identical copy over <strong>every</strong> interface simultaneously. Whichever packet reaches the Tunnely Entry node first is processed; the duplicates are silently discarded. This guarantees absolute zero-loss failover. If your Wi-Fi violently drops, the packet sent over 5G still arrives, ensuring a live video call or VoIP stream never drops a single frame.
          </p>
        </div>
      </div>

      <div className="p-6 border border-yellow-500/30 bg-yellow-500/5 mt-12">
        <h4 className="font-bold text-yellow-500 uppercase tracking-widest text-xs flex items-center gap-2 m-0 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Bandwidth Warning
        </h4>
        <p className="text-sm text-yellow-500/80 m-0">
          Utilizing Reliability Mode fundamentally doubles or triples your external bandwidth consumption (since every packet is duplicated across all networks). Ensure you have adequate cellular data caps before enabling this mode on metered connections.
        </p>
      </div>
    </div>
  );
}
