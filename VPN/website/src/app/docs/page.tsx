import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tunnely Documentation & Getting Started Guide",
  description: "Official documentation for the Tunnely zero-knowledge VPN network and desktop client. Learn how to config your daemon and secure your digital footprint.",
  keywords: ["tunnely docs", "tunnely vpn documentation", "multi-hop vpn config", "zero-knowledge vpn tutorial", "tauri vpn client", "rust vpn documentation"],
  openGraph: {
    title: "Tunnely Documentation & Getting Started Guide",
    description: "Official documentation for the Tunnely zero-knowledge VPN network and desktop client. Learn how to config your daemon and secure your digital footprint.",
    url: "/docs",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely Documentation | Getting Started",
    description: "Official documentation for configuring the Tunnely zero-knowledge privacy network.",
  }
};

export default function DocsIndex() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Introduction to <span className="text-primary">Tunnely</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        Tunnely is an advanced, zero-knowledge, multi-hop relay network engineered in Rust. It focuses on absolute privacy by decentralizing network trust across independent nodes.
      </p>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="border border-white/[0.08] p-6 bg-[#0A0A0A] hover:border-primary/30 transition-colors">
          <h3 className="font-mono text-sm uppercase text-primary font-bold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary animate-pulse-glow" />
            Quick Start
          </h3>
          <p className="text-sm text-text-dim mb-4">
            Download the desktop client and securely connect to the relay network in under 60 seconds.
          </p>
          <a href="/docs/quick-start" className="text-xs font-mono uppercase tracking-widest text-primary hover:text-white transition-colors">
            Install Client →
          </a>
        </div>

        <div className="border border-white/[0.08] p-6 bg-[#0A0A0A] hover:border-primary/30 transition-colors">
          <h3 className="font-mono text-sm uppercase text-primary font-bold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary animate-pulse-glow" />
            Core Architecture
          </h3>
          <p className="text-sm text-text-dim mb-4">
            Understand how our proprietary multi-hop WireGuard implementation guarantees zero-knowledge routing.
          </p>
          <a href="/docs/architecture" className="text-xs font-mono uppercase tracking-widest text-primary hover:text-white transition-colors">
            Read Whitepaper →
          </a>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-6 uppercase tracking-wider">Why Tunnely?</h2>
      <p>
        Traditional consumer VPNs act as a single point of failure. You trade your local ISP's surveillance for the VPN provider's surveillance. When they are compromised, you are compromised.
      </p>
      <p>
        Tunnely mitigates this via a <strong>multi-hop architecture</strong>:
      </p>
      <ul>
        <li><strong>Entry Nodes</strong> know who you are, but not what you are fetching.</li>
        <li><strong>Exit Nodes</strong> know what is being fetched, but have no cryptographically verifiable way to link it back to your origin IP.</li>
        <li>Your ISP only sees encrypted WireGuard fragments multiplexed across multiple network interfaces (Channel Bonding).</li>
      </ul>

      <blockquote className="border-l-2 border-primary bg-primary/5 p-4 my-8 italic text-text-dim">
        "Privacy shouldn't be a premium add-on; it should be an unavoidable consequence of the system's architecture."
      </blockquote>

      <p>
        Ready to dive deep? Explore the sidebar navigation to learn about configuring the routing daemon or spinning up your own decentralized relay.
      </p>
    </div>
  );
}
