import type { Metadata } from "next";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { CTASection } from "@/components/marketing/CTASection";
import {
  Route,
  Combine,
  ShieldCheck,
  EyeOff,
  Gauge,
  MonitorSmartphone,
  ServerCrash,
  ShieldBan
} from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Features",
  description:
    "Multi-hop relay routing, channel bonding, WireGuard encryption, QUIC obfuscation, and more. Discover the privacy features that make Tunnely different.",
  keywords: ["multi-hop VPN", "channel bonding", "WireGuard", "QUIC obfuscation", "kill switch", "adblock VPN", "VPN features"],
  openGraph: {
    title: "Privacy Features | Tunnely",
    description:
      "Multi-hop relay routing, channel bonding, WireGuard encryption, QUIC obfuscation, and system-level adblocking.",
    url: "/features",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Features | Tunnely",
    description: "Multi-hop routing, channel bonding, WireGuard encryption, and system-level adblocking.",
  },
};

const deepDiveFeatures = [
  {
    icon: Route,
    title: "Intelligent Path Selection",
    description:
      "Our Dijkstra-based routing algorithm analyzes real-time latency, jitter, and packet loss between relays to find the fastest path for your traffic. Routes are recomputed every 60 seconds.",
    details: [
      "Latency-aware path optimization",
      "Automatic failover on packet loss",
      "Up to 5 intermediate hops depending on subscription tier",
      "Sub-second path recomputation",
    ],
  },
  {
    icon: Combine,
    title: "Speedify-Class Channel Bonding",
    description:
      "Simultaneously use multiple network interfaces  - WiFi, Ethernet, and Cellular  - with intelligent packet distribution. Get the combined throughput of all your connections.",
    details: [
      "Speed mode: Weighted round-robin distribution",
      "Redundancy mode: Duplicate critical packets",
      "Quality mode: Latency-aware scheduling",
      "Per-channel health monitoring with EWMA smoothing",
    ],
  },
  {
    icon: ShieldBan,
    title: "System-Level HTTPS Interception",
    description:
      "A fully localized Man-in-the-Middle proxy blocks malicious ads and trackers. Generates its own OS-level Root CA and forces QUIC downgrades to expose embedded modern trackers.",
    details: [
      "Client-side HTTPS cosmetic filtering",
      "Daily background EasyList updates",
      "Forces HTTP3/QUIC rollback to intercept evasive payloads",
      "Automated system trust store integration",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Server-Side CNAME Uncloaking",
    description:
      "Advanced DNS filtering at the relay exit node. CNAME uncloaking exposes third-party trackers masking themselves under innocent first-party domains.",
    details: [
      "Automatic backend DNS proxying and caching",
      "Intercepts and blocks DoH/DoT network traffic via nftables",
      "First-party sub-domain tracker exposing",
      "Instant null-routing for malicious endpoints",
    ],
  },
  {
    icon: ServerCrash,
    title: "Kernel Failsafe Kill Switch",
    description:
      "Network traffic is strictly barred at the OS firewall layer if the primary connection securely drops to the initial relay node. Zero IP leaking during active reconnections.",
    details: [
      "Blocks all non-tunneled internet bound traffic",
      "Automatic activation on Wi-Fi state shifts",
      "System sleep/wake state binding",
      "OS-native firewall routing rules",
    ],
  },
  {
    icon: EyeOff,
    title: "QUIC Obfuscation Layer",
    description:
      "Wrap your VPN traffic in QUIC/TLS 1.3 on port 443. To any observer, your traffic looks like standard HTTPS. Defeats deep packet inspection.",
    details: [
      "Mimics HTTPS traffic patterns",
      "TLS 1.3 encryption wrapper",
      "Port 443  - indistinguishable from web traffic",
      "Bypasses corporate firewalls and censorship",
    ],
  },
  {
    icon: Gauge,
    title: "Performance Optimized",
    description:
      "Tunnely servers run on bare metal with Tokio async runtime. Atomic IP allocation, zero-copy packet forwarding, and kernel-level optimizations.",
    details: [
      "Rust-based relay servers (zero-cost abstractions)",
      "Tokio async runtime for maximum concurrency",
      "65,000+ pre-allocated tunnel IPs",
      "nftables-based packet forwarding",
    ],
  },
  {
    icon: MonitorSmartphone,
    title: "Desktop Native Experience",
    description:
      "Built with Rust & Tauri for a lightweight, native desktop experience. System tray integration, OS-level keychain storage, and platform-specific optimizations.",
    details: [
      "Windows, macOS, and Linux support",
      "10x smaller than Electron apps",
      "Native system tray with quick controls",
      "Automatic reconnection on network change",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="py-24 relative">
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-6 uppercase tracking-tight text-white gap-2 flex flex-col items-center">
            <span>Every Feature</span>
            <span className="text-primary border-b-4 border-primary pb-2 inline-block">You Need</span>
          </h1>
          <p className="text-sm font-mono text-text-dim max-w-2xl mx-auto tracking-widest uppercase mt-8">
            From multi-hop routing to channel bonding, every feature is
            engineered for privacy and performance.
          </p>
        </div>
      </section>

      {/* Feature overview grid */}
      <FeatureGrid />

      {/* Deep dive section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center mb-16 uppercase tracking-tight text-white flex justify-center items-center gap-2">
            <span>Under the</span> <span className="text-primary">Hood</span>
          </h2>

          <div className="space-y-8">
            {deepDiveFeatures.map((feature, i) => (
              <div
                key={feature.title}
                className="bg-[#121212] border border-white/[0.08] p-8 md:p-10 grid md:grid-cols-2 gap-8 items-center"
              >
                <div>
                  <div className="w-12 h-12 bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-6">
                    <feature.icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-sm font-mono text-text-dim leading-loose">
                    {feature.description}
                  </p>
                </div>
                <ul className="space-y-4">
                  {feature.details.map((detail) => (
                    <li
                      key={detail}
                      className="flex items-start gap-4 text-sm font-mono text-text-dim uppercase tracking-wide"
                    >
                      <span className="w-1.5 h-1.5 rounded-none bg-primary mt-1.5 flex-shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
