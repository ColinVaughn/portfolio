import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DNS Adblock Engine | Tunnely Docs",
  description: "Learn how Tunnely utilizes a Rust-based adblock engine to sinkhole trackers, malware, and telemetry at the DNS level before they reach your browser.",
  keywords: ["tunnely adblock", "dns sinkhole vpn", "block trackers vpn", "brave adblock rust", "cyber_sec_enabled", "tunnely privacy engine"],
  openGraph: {
    title: "DNS Adblock Engine | Tunnely Docs",
    description: "Learn how Tunnely utilizes a Rust-based adblock engine to sinkhole trackers, malware, and telemetry at the DNS level before they reach your browser.",
    url: "/docs/adblock",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely DNS Adblock Engine",
    description: "Sinkhole trackers and malware before they reach your device.",
  }
};

export default function AdblockDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Adblock <span className="text-primary">Engine</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        VPN encryption protects your packet in transit, but it does nothing to stop the servers you connect to from tracking you. Tunnely integrates a system-wide DNS sinkhole directly into the client daemon to execute tracker payloads before they load.
      </p>

      <h2>The Sinkhole Mechanism</h2>
      <p>
        In the application dashboard, you can toggle <strong>CyberSec</strong> on or off. This maps to the <code>cyberSecEnabled</code> parameter in the local daemon state.
      </p>
      <p>
        When enabled, Tunnely injects a local DNS resolver (127.0.0.1:53) into the virtual WireGuard interface routing table. Before any outbound packet enters the mesh, the operating system asks this local resolver where the domain name is located.
      </p>

      <div className="p-6 bg-[#0A0A0A] border border-white/[0.08] my-8 font-mono text-xs overflow-x-auto">
        <pre className="!bg-transparent !p-0 !m-0 border-0 text-text-dim">
{`[Web Browser] -- requests --> "google-analytics.com"
       ↓
[Tunnely Local DNS Resolver]
       ↓
[Rust Adblock Filter Engine] --> Matches blocklist rule (*.google-analytics.com)
       ↓
[Result] --> Returns "0.0.0.0" directly to browser (Sinkholed)`}
        </pre>
      </div>

      <h2>Brave's Rust Engine</h2>
      <p>
        Rather than building a subpar regular expression engine from scratch, the Tunnely daemon embeds <code>adblock-rust</code>, the exact underlying C++-compatible Rust crate that powers the Brave Browser's native adblocking capabilities.
      </p>
      <p>
        This engine evaluates network requests against over 300,000 active rules in under 15 microseconds, providing a zero-latency browsing experience while instantly neutralizing:
      </p>
      <ul>
        <li>Cross-site trackers and telemetry pingbacks.</li>
        <li>Known malware distribution grids.</li>
        <li>Aggressive crypto-mining scripts.</li>
        <li>Intrusive visual advertisements that drain bandwidth.</li>
      </ul>

      <h2>Filter Lists</h2>
      <p>
        By default, the daemon fetches and aggregates the following filter lists upon initialization:
      </p>
      <ul>
        <li><strong>EasyList</strong> (Standard adblocking)</li>
        <li><strong>EasyPrivacy</strong> (Anti-tracking)</li>
        <li><strong>Peter Lowe's Ad/Tracking List</strong></li>
        <li><strong>Tunnely Core Telemetry Filters</strong> (Custom rulesets targeting OS-level data collection)</li>
      </ul>
      <p>
        These lists are safely cached locally within your application data directory to ensure immediate protection upon system boot, prior to establishing a connection with the distant relay mesh.
      </p>
    </div>
  );
}
