import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Relay Network Overview | Tunnely Docs",
  description: "Understand the backbone of Tunnely. Learn how decentralized nodes communicate via the server-to-server mesh to guarantee zero-knowledge packet delivery.",
  keywords: ["tunnely relay network", "decentralized vpn nodes", "vpn mesh topology", "server to server routing", "operate a vpn relay"],
  openGraph: {
    title: "Relay Network Overview | Tunnely Docs",
    description: "Understand the backbone of Tunnely. Learn how decentralized nodes communicate via the server-to-server mesh to guarantee zero-knowledge packet delivery.",
    url: "/docs/relay-network",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely Relay Network Overview",
    description: "The decentralized backbone that powers the zero-knowledge topology.",
  }
};

export default function RelayNetworkDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Relay <span className="text-primary">Network</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        The Tunnely infrastructure is not a monoculture of servers owned by a single corporation. It is a distributed, cryptographically secured mesh network of independent relays.
      </p>

      <h2>The Node Lifecycle</h2>
      <p>
        Every active server in the Tunnely network is running the <code>relay-core</code> headless daemon. This Rust-based application manages three primary obligations:
      </p>
      <ol>
        <li><strong>Client Handshakes:</strong> Negotiating standard WireGuard tunnels with end-user devices acting as an Entry point.</li>
        <li><strong>Mesh Communication:</strong> Maintaining persistent, encrypted tunnels with other online relay servers in the network.</li>
        <li><strong>NAT Obfuscation:</strong> Serving as an Exit point, translating inbound mesh traffic onto the public internet and returning the responses.</li>
      </ol>

      <h2>The Server-to-Server Mesh</h2>
      <p>
        When a new relay boots up, it pings the central Supabase Edge Functions via the <code>/functions/v1/register-server</code> endpoint. Upon successful authentication (using Service Role keys), it is admitted to the global topology.
      </p>
      <p>
        The relay immediately pulls down the public keys and IP addresses of all other active nodes in the network. It systematically establishes strict, peer-to-peer WireGuard connections with every one of them. This creates a dense, interconnected web.
      </p>

      <div className="p-6 bg-[#0A0A0A] border border-white/[0.08] my-8 font-mono text-xs overflow-x-auto">
        <pre className="!bg-transparent !p-0 !m-0 border-0 text-text-dim text-center">
{`          [Relay A] --- [Relay B]
         /         \\   /         \\
 [Relay C] -------- [Relay D] -------- [Relay E]
         \\         /   \\         /
          [Relay F] --- [Relay G]`}
        </pre>
      </div>

      <h3>Why a Mesh?</h3>
      <p>
        Because all servers are permanently connected to all other servers, the latency required to hop between an Entry Node and an Exit Node is effectively zero overhead beyond the physical fiber distance. 
      </p>
      <p>
        When a user connects through Relay C (the Entry) and requests traffic be exited via Relay G, Relay C does not need to pause and establish a new encrypted tunnel on demand. It simply routes the user's pre-encrypted packet over the existing persistent mesh link to Relay G entirely in kernel space.
      </p>
      
      <h2>Community Operated Nodes (Future Proposal)</h2>
      <p>
        Currently, the mesh infrastructure is operated by the Tunnely core team to ensure strict quality-of-service and bandwidth SLAs for our Pro and Enterprise users. However, the exact same `relay-core` codebase that builds our internal network is open source. 
      </p>
      <p>
        Our roadmap includes cryptographic Proof-of-Bandwidth implementations that will allow third-party contributors to operate community nodes, furthering the decentralized nature of the routing topology.
      </p>
    </div>
  );
}
