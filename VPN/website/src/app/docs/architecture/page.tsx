import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zero-Knowledge VPN Architecture | Tunnely Docs",
  description: "Deep dive into Tunnely's multi-hop privacy topology. Learn how our decentralized relay network utilizes WireGuard to enforce zero-knowledge packet routing.",
  keywords: ["zero-knowledge architecture", "multi-hop vpn topology", "wireguard relay network", "decentralized vpn nodes", "tunnely architecture", "privacy networking"],
  openGraph: {
    title: "Zero-Knowledge VPN Architecture | Tunnely Docs",
    description: "Deep dive into Tunnely's multi-hop privacy topology. Learn how our decentralized relay network utilizes WireGuard to enforce zero-knowledge packet routing.",
    url: "/docs/architecture",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely Architecture: Zero-Knowledge Topology",
    description: "Learn how the Tunnely network utilizes decentralized relays to enforce absolute privacy.",
  }
};

export default function ArchitectureDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Zero-Knowledge <span className="text-primary">Architecture</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        A system where trust is decentralized. No single node, including the entry point, posesses enough state to link a user identity to their destination traffic.
      </p>

      <h2>The Problem with Single-Hop Standard VPNs</h2>
      <p>
        In a standard VPN configuration, your device creates an encrypted tunnel to a single provider-operated server. 
      </p>
      <ul>
        <li>That server decrypts your packet.</li>
        <li>It reads the destination IP.</li>
        <li>It forwards the packet.</li>
      </ul>
      <p>
        <strong>The Flaw:</strong> The server knows exactly who you are (your home IP) and exactly where you are going. If that server is compromised, subpoenaed, or maliciously logging traffic, your privacy is zero.
      </p>

      <h2>The Tunnely Multi-Hop Topology</h2>
      <p>
        Tunnely forces packets through a minimum of two distinct, decentralized relay nodes.
      </p>
      
      <div className="p-6 bg-[#0A0A0A] border border-white/[0.08] my-8 font-mono text-xs overflow-x-auto">
        <pre className="!bg-transparent !p-0 !m-0 border-0 text-text-dim">
{`[Client / Origin]
       ↓ (WireGuard Tunnel)
[Entry Node] --> Knows Client IP.
             --> Forwards packet into Internal Mesh.
       ↓ (Encrypted Server-to-Server Mesh)
[Exit Node]  --> Knows Destination IP.
             --> Does NOT know Client IP (sees only Entry Node IP).
       ↓ (Public Internet)
[Destination Web Server]`}
        </pre>
      </div>

      <h3>Cryptographic Enforcement</h3>
      <p>
        The Tunnely client application establishes a secure, single-hop WireGuard tunnel directly to the Entry Node. Rather than decrypting the packet and dropping it onto the public internet, the Entry Node acts as a secure router.
      </p>
      <p>
        Upon receiving the packet, the Entry Node forwards it through a dedicated, cryptographically verifiable server-to-server mesh network to the assigned Exit Node. The Exit Node alone performs the final NAT translation necessary to reach the destination web server. This ensures that the Entry Node never sees the destination, and the Exit Node never sees the origin.
      </p>
    </div>
  );
}
