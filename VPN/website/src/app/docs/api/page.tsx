import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Backend API Reference & Endpoints | Tunnely Docs",
  description: "Interact with the Tunnely network programmatically. API reference for fetching topologies, telemetry metrics, and registering remote relays.",
  keywords: ["tunnely api", "vpn api reference", "relay network endpoints", "decentralized node registration", "tunnely developer documentation", "rest api auth"],
  openGraph: {
    title: "Backend API Reference & Endpoints | Tunnely Docs",
    description: "Interact with the Tunnely network programmatically. API reference for fetching topologies, telemetry metrics, and registering remote relays.",
    url: "/docs/api",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely Developer API Reference",
    description: "RESTful specification for interacting with the Tunnely relay network topology.",
  }
};

export default function ApiDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        API <span className="text-primary">Reference</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        The Tunnely backend exposes a strictly authenticated RESTful API for fetching routing configurations, parsing telemetry, and spinning up new decentralized relay instances.
      </p>

      <h2>Authentication</h2>
      <p>
        All API endpoints require a Bearer token issued by our centralized auth cluster. You can generate a persistent access token via the desktop client dashboard.
      </p>
      
      <div className="p-4 bg-[#0A0A0A] border border-white/[0.08] my-6 font-mono text-sm">
        <span className="text-primary font-bold">Header:</span> <code>Authorization: Bearer &lt;tunnely_pk_...&gt;</code>
      </div>

      <h2>Endpoints</h2>

      <div className="space-y-12 mt-8">
        {/* Endpoint 1 */}
        <div className="border border-white/[0.08] bg-[#121212] overflow-hidden">
          <div className="flex items-center gap-4 bg-[#0A0A0A] p-4 border-b border-white/[0.08]">
            <span className="px-2 py-1 bg-blue-500/10 text-blue-500 font-mono text-xs font-bold uppercase tracking-widest border border-blue-500/20">POST</span>
            <code className="text-white text-sm">/functions/v1/generate-client-config</code>
          </div>
          <div className="p-6">
            <p className="mt-0 text-text-dim text-sm">Calculates the optimal multi-hop path and returns the WireGuard configuration required for the client to connect to the entry node. Enforces active subscription plans.</p>
            
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mt-6 mb-2">Payload</h4>
            <pre className="!mt-0">
{`{
  "client_public_key": "aZx3...9kL",
  "preferred_region": "us-east",
  "bonding_mode": "Speed"
}`}
            </pre>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mt-6 mb-2">Response (200 OK)</h4>
            <pre className="!mt-0">
{`{
  "session_id": "...",
  "assigned_ip": "10.0.0.5",
  "relay_path": ["entry-uuid", "exit-uuid"],
  "wg_quick_config": "[Interface]\\nAddress = 10.0.0.5/32..."
}`}
            </pre>
          </div>
        </div>

        {/* Endpoint 2 */}
        <div className="border border-white/[0.08] bg-[#121212] overflow-hidden">
          <div className="flex items-center gap-4 bg-[#0A0A0A] p-4 border-b border-white/[0.08]">
            <span className="px-2 py-1 bg-blue-500/10 text-blue-500 font-mono text-xs font-bold uppercase tracking-widest border border-blue-500/20">POST</span>
            <code className="text-white text-sm">/functions/v1/register-server</code>
          </div>
          <div className="p-6">
            <p className="mt-0 text-text-dim text-sm">Registers a new community-operated relay node into the global topology. Requires a valid service role API key to authenticate.</p>
            
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mt-6 mb-2">Payload</h4>
            <pre className="!mt-0">
{`{
  "hostname": "relay-fra-01",
  "region": "eu-central-1",
  "public_ip": "203.0.113.50",
  "wireguard_port": 51820,
  "mesh_port": 51821,
  "public_key": "aZx3...9kL"
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
