import type { Metadata } from "next";
import { Shield, Lock, Eye, Server, ChevronRight, Crosshair, Network, ShieldAlert } from "lucide-react";
import { CTASection } from "@/components/marketing/CTASection";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Tunnely  - our mission to make multi-hop privacy accessible to everyone. Built with WireGuard, Rust, and a commitment to zero-knowledge architecture.",
  keywords: ["about tunnely", "VPN mission", "zero-knowledge VPN", "open source VPN", "privacy by architecture", "Rust VPN"],
  openGraph: {
    title: "About Tunnely",
    description:
      "Our mission: privacy enforced by mathematics and code, not terms of service. Built with WireGuard, Rust, and zero-knowledge architecture.",
    url: "/about",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Tunnely",
    description: "Privacy enforced by code. Built with WireGuard, Rust, and zero-knowledge architecture.",
  },
};

const values = [
  {
    id: "01",
    icon: Shield,
    title: "Privacy Precedence",
    description:
      "Every architectural decision starts with a single constraint: does this protect the end-user? We implement rigorous privacy methodologies over convenience, every time.",
  },
  {
    id: "02",
    icon: Lock,
    title: "Open Infrastructure",
    description:
      "Our core relay daemon is strictly open-source. Security researchers can audit the codebase, compile locally, and continuously verify our cryptographic claims.",
  },
  {
    id: "03",
    icon: Eye,
    title: "Zero Knowledge",
    description:
      "We cannot decrypt your payload. The multi-hop topology ensures no single relay instance holds the state of both your origin IP and your destination.",
  },
  {
    id: "04",
    icon: Server,
    title: "Performance Constraints",
    description:
      "Engineered in Rust for zero-cost hardware abstractions. Our proprietary channel bonding algorithms keep packet latency to an absolute minimum globally.",
  },
];

export default function AboutPage() {
  return (
    <>
      <main className="pt-16 bg-[#121212] min-h-screen">
        {/* Header Module */}
        <section className="py-24 relative border-b border-white/[0.08]">
          <div className="relative max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/10 text-primary uppercase tracking-widest font-mono text-[10px] font-bold mb-6">
                <Shield className="w-3.5 h-3.5" strokeWidth={2} />
                Engineering Manifesto
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight uppercase tracking-tight">
                Privacy By<br />
                <span className="text-primary">Architecture</span>
              </h1>
            </div>
            <div className="border-l border-white/[0.08] pl-8">
              <p className="text-base text-text-dim leading-relaxed font-mono">
                Tunnely was engineered from a simple computational belief: network packet activity is nobody else's business. We construct infrastructure where true privacy is enforced by mathematics and code layout, not just terms of service policies.
              </p>
            </div>
          </div>
        </section>

        {/* Mission Statement */}
        <section className="py-24 border-b border-white/[0.08] bg-bg relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-6 relative z-10">
            <h2 className="text-xl font-mono text-primary font-bold uppercase tracking-widest mb-12 flex items-center gap-4">
              <span className="w-8 h-[1px] bg-primary"></span>
              Core Philosophy
            </h2>
            <div className="space-y-8 font-mono text-text-dim leading-relaxed text-sm">
              <p className="p-6 border border-white/[0.08] bg-[#121212]">
                Traditional single-hop architectures enforce trust upon a single entity. The entry node processes everything  - your IP, your destination, your payload telemetry. That's not privacy; that's simply migrating surveillance logs from your local ISP directly to a centralized VPN provider.
              </p>
              <div className="flex flex-col gap-8 pl-12 border-l border-primary/30 py-4">
                <p>
                  Tunnely implements a radical cryptographic shift. Traffic is routed violently through multiple independent decentralized relay nodes. The entry server identifies you, but remains blind to your destination. The exit node transmits to your destination, but remains blind to your origin identity.
                </p>
                <p>
                  Combined with OS-level channel bonding  - the ability to multiplex packet fragments across independent network interfaces  - we guarantee both privacy and raw bandwidth. Your local ISP only sniffs chaotic encrypted fragments. The relays only process encrypted hops. Zero-knowledge visibility.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="py-24 border-b border-border bg-[#121212]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-16">
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                Engineering Tenets
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-[1px] bg-white/[0.08] border border-white/[0.08]">
              {values.map((value) => (
                <div key={value.title} className="bg-[#121212] p-10 hover:bg-white/[0.02] transition-colors flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/[0.08]">
                    <div className="p-3 border border-white/[0.08] bg-white/[0.02]">
                      <value.icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                    </div>
                    <span className="font-mono text-xs font-bold text-white/[0.2] tracking-widest">{value.id}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">
                    {value.title}
                  </h3>
                  <p className="text-sm font-mono text-text-dim leading-relaxed flex-1">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Deep Dive 1: Adblock System */}
        <section className="py-24 border-b border-border bg-[#121212]">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 border border-primary/30 bg-primary/10 mb-8">
                <Crosshair className="w-6 h-6 text-primary" strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-6">
                Zero-Trust Adblock Proxy
              </h2>
              <div className="space-y-6 text-sm font-mono text-text-dim leading-relaxed">
                <p>
                  Cosmetic network filtering over an encrypted VPN is traditionally impossible without compromising the server's zero-knowledge guarantee. Sending decrypted traffic to a remote relay for filtering mathematically destroys the privacy model.
                </p>
                <p>
                  Instead, the Tunnely client installs a localized, ephemeral Root Certificate Authority directly onto your OS. It acts as an aggressive MITM (Man-in-the-Middle) proxy sitting entirely on the client machine.
                </p>
                <p>
                  Traffic is intercepted locally, decrypted, sanitized against our aggressive filter lists, and immediately re-encrypted before it ever touches the WireGuard tunnel or exits your network interface. The remote relays remain completely blind to your payload content.
                </p>
              </div>
            </div>
            
            {/* Visual representation card */}
            <div className="border border-white/[0.08] bg-bg p-8 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
               <div className="w-full max-w-sm space-y-4">
                  <div className="flex items-center justify-between p-4 border border-white/[0.08] bg-[#121212]">
                    <span className="font-mono text-xs text-text-dim">TLS Handshake</span>
                    <span className="text-success text-xs font-bold uppercase tracking-widest">Intercepted</span>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-primary/30 bg-primary/5">
                    <span className="font-mono text-xs text-primary">Payload Scrubbing</span>
                    <span className="text-primary text-xs font-bold uppercase tracking-widest">Active</span>
                  </div>
                   <div className="flex items-center justify-between p-4 border border-white/[0.08] bg-[#121212]">
                    <span className="font-mono text-xs text-text-dim">WireGuard Tunnel</span>
                    <span className="text-success text-xs font-bold uppercase tracking-widest">Encrypted</span>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Deep Dive 2: Channel Bonding */}
        <section className="py-24 border-b border-white/[0.08] bg-bg">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            {/* Visual representation card (Left side on desktop) */}
            <div className="order-2 md:order-1 border border-white/[0.08] bg-[#121212] p-8 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
                <div className="w-full max-w-sm flex items-center justify-between relative">
                  <div className="w-16 h-16 border border-white/[0.08] flex items-center justify-center bg-bg z-10 font-mono text-xs font-bold text-white/[0.5] uppercase tracking-widest">Client</div>
                  
                  {/* Lines */}
                  <div className="absolute inset-x-0 h-[1px] bg-primary/30 top-1/4 z-0" />
                  <div className="absolute inset-x-0 h-[1px] bg-primary/30 bottom-1/4 z-0" />
                  
                  <div className="flex flex-col gap-8 z-10 w-24">
                     <span className="text-[10px] font-mono border border-primary/30 bg-[#121212] px-2 py-1 text-primary text-center">wlan0</span>
                     <span className="text-[10px] font-mono border border-primary/30 bg-[#121212] px-2 py-1 text-primary text-center">eth0</span>
                  </div>

                  <div className="w-16 h-16 border border-white/[0.08] flex items-center justify-center bg-bg z-10 font-mono text-xs font-bold text-white/[0.5] uppercase tracking-widest">Relay</div>
                </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="inline-flex items-center justify-center w-12 h-12 border border-primary/30 bg-primary/10 mb-8">
                <Network className="w-6 h-6 text-primary" strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-6">
                OS-Level Channel Bonding
              </h2>
              <div className="space-y-6 text-sm font-mono text-text-dim leading-relaxed">
                <p>
                  Typical VPN implementations bind the encrypted tunnel to a single network interface (like your Wi-Fi card). If that adapter drops packets or loses signal, your entire connection stalls until the handshake is renegotiated by the daemon.
                </p>
                <p>
                  Tunnely's Rust client intercepts the raw TUN interface stream and aggressively fragments every packet. These fragments are simultaneously multiplexed across all available network hardware  - utilizing Wi-Fi, Ethernet, and Cellular layers concurrently.
                </p>
                <p>
                  By treating your various hardware adapters as parallel bandwidth pipes, we effectively aggregate your bandwidth thresholds while providing absolute redundancy. A Wi-Fi dropout simply means the remaining fragments continue flowing uninterrupted over Cellular.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Deep Dive 3: Bare-Metal Relays */}
        <section className="py-24 border-b border-border bg-[#121212]">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 border border-primary/30 bg-primary/10 mb-8">
                <Server className="w-6 h-6 text-primary" strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-6">
                Bare-Metal VPS Infrastructure
              </h2>
              <div className="space-y-6 text-sm font-mono text-text-dim leading-relaxed">
                <p>
                  Our relay network relies on highly-optimized bare-metal Linux servers operating entirely out of RAM cache. We utilize <code className="text-primary tracking-widest bg-primary/10 px-1 py-0.5">Tokio</code> as a multi-threaded async runtime to route millions of concurrent stateless packets with zero I/O execution locks.
                </p>
                <p>
                  Privacy begins where data retention ends. These relays are purposefully configured with Read-Only OS images. We use rigid <code className="text-primary tracking-widest bg-primary/10 px-1 py-0.5">nftables</code> policies for dynamic IP masquerading, ensuring outbound network traffic is completely disassociated from the origin client.
                </p>
                <p>
                  Additionally, the relay daemon explicitly denies inbound ICMP or extraneous protocol handshakes. The server will only acknowledge geometrically perfect cryptokey handshakes, making the node completely black-holed to standard Nmap port scans or automated exploitation bots.
                </p>
              </div>
            </div>
            
             <div className="border border-white/[0.08] bg-bg p-8 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
               <div className="w-full font-mono text-xs text-primary/70 bg-[#121212] p-4 border border-white/[0.08] relative overflow-hidden">
                  <div className="flex justify-between border-b border-white/[0.08] pb-2 mb-4">
                    <span>root@relay-nyc-01:~#</span>
                    <span className="text-white/[0.2]">nft list ruleset</span>
                  </div>
                  <pre className="leading-relaxed whitespace-pre-wrap">
{`table inet relay_nat {
  chain postrouting {
    type nat hook postrouting priority srcnat;
    oifname "eth0" masquerade
  }
  chain forward {
    type filter hook forward priority filter;
    ct state established,related accept
    iifname "wg-*" accept
    drop
  }
}`}
                  </pre>
               </div>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="py-24 bg-bg">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">
                  Tech Stack
                </h2>
                <p className="text-text-dim font-mono max-w-lg">
                  We deploy only performant, battle-tested modern architectures emphasizing memory safety and speed.
                </p>
              </div>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary font-mono text-sm font-bold uppercase tracking-widest hover:text-white transition-colors">
                View Source Code
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-white/[0.08] border border-white/[0.08]">
              {[
                { name: "Rust", desc: "Core Relay Daemon" },
                { name: "WireGuard", desc: "Cryptography" },
                { name: "Tauri", desc: "Client Binaries" },
                { name: "Tokio", desc: "Async Runtime" },
                { name: "React", desc: "Marketing UI" },
                { name: "Postgres", desc: "Cluster Auth" },
                { name: "Root CA", desc: "Zero-Trust MITM Proxy" },
                { name: "nftables", desc: "Packet Framework" },
              ].map((tech) => (
                <div
                  key={tech.name}
                  className="bg-[#121212] p-8 hover:bg-white/[0.02] transition-colors"
                >
                  <p className="text-lg font-black text-white uppercase tracking-tight mb-2">{tech.name}</p>
                  <p className="text-xs font-mono text-text-dim uppercase tracking-widest">{tech.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTASection />
      </main>
    </>
  );
}
