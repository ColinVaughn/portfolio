import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Anti-Censorship & DPI Evasion | Tunnely Docs",
  description: "Learn how the Tunnely network evades Deep Packet Inspection (DPI) and authoritarian firewalls. Explore our QUIC obfuscation and domain fronting strategies.",
  keywords: ["anti censorship vpn", "evade dpi vpn", "bypass great firewall", "quic obfuscation", "domain fronting", "tunnely censorship"],
  openGraph: {
    title: "Anti-Censorship & DPI Evasion | Tunnely Docs",
    description: "Learn how the Tunnely network evades Deep Packet Inspection (DPI) and authoritarian firewalls. Explore our QUIC obfuscation and domain fronting strategies.",
    url: "/docs/anti-censorship",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely Anti-Censorship Infrastructure",
    description: "Evade Deep Packet Inspection and authoritarian firewalls.",
  }
};

export default function AntiCensorshipDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Anti-Censorship <span className="text-primary">Evasion</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        A standard WireGuard handshake is highly recognizable. Authoritarian firewalls (like the GFW) use Deep Packet Inspection (DPI) to identify the static headers of typical VPN protocols and silently drop the connection. Tunnely implements aggressive countermeasures.
      </p>

      <h2>QUIC Obfuscation</h2>
      <p>
        To bypass signature-based DPI, Tunnely can wrap its standard WireGuard UDP packets inside of entirely synthetic QUIC (HTTP/3) frames.
      </p>
      <p>
        When the local daemon detects repeated connection timeouts, it dynamically falls back to Obfuscation Mode. The daemon constructs a valid TLS 1.3 ClientHello matching the fingerprint of a standard Chromium web browser attempting to negotiate an HTTP/3 connection.
      </p>
      <p>
        The authoritarian firewall inspects the packet, identifies it as standard web traffic heading to a presumed web server, and allows the UDP datagram to pass. Once it reaches the Tunnely Entry relay, the synthetic QUIC headers are stripped away, revealing the pristine, encrypted WireGuard packet underneath.
      </p>

      <h2>Domain Fronting (Emergency Fallback)</h2>
      <p>
        In extreme scenarios where the exit IP address of the Tunnely relay itself is blocked via an IP blacklist, the client will attempt to bootstrap via Domain Fronting.
      </p>
      <p>
        The client routes its initial cryptographic handshake physically to a highly-reputable, "uncensorable" CDN (Content Delivery Network, e.g., Cloudflare, CloudFront). Because blocking an entire CDN IP block would cripple the nation's internet functionality, the connection is allowed.
      </p>
      <p>
        However, the HTTP Host header encrypted within the secure TLS envelope instructs the CDN's edge server to route the request internally to the Tunnely backend API, completely bypassing the national IP blacklist.
      </p>

      <div className="p-6 border border-white/[0.08] bg-[#0A0A0A] mt-8 mb-12">
        <h3 className="m-0 mb-4 uppercase tracking-widest text-[#a1a1aa] text-xs font-bold">Network Performance Impact</h3>
        <p className="text-sm m-0 text-text-dim">
          Adding Obfuscation headers inherently balloons the MTU (Maximum Transmission Unit) fragmentation and adds cryptographic overhead. Therefore, these evasion techniques are disabled by default on healthy networks to prioritize raw throughput, and are dynamically engaged only when network interference is algorithmically detected.
        </p>
      </div>
    </div>
  );
}
