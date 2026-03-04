import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client CLI Documentation | Tunnely Docs",
  description: "Control the Tunnely daemon directly from your terminal. Full reference for the Command Line Interface (CLI) commands, arguments, and scripting integration.",
  keywords: ["tunnely cli", "vpn command line", "tunnely terminal", "scripting vpn", "vpn daemon control", "linux vpn cli"],
  openGraph: {
    title: "Client CLI Documentation | Tunnely Docs",
    description: "Control the Tunnely daemon directly from your terminal. Full reference for the Command Line Interface (CLI) commands, arguments, and scripting integration.",
    url: "/docs/cli",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely CLI Reference",
    description: "Control your zero-knowledge network daemon from the terminal.",
  }
};

export default function CliDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Client <span className="text-primary">CLI</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        The Tunnely desktop GUI is entirely optional. Power users and server administrators can interface directly with the local <code>tunnely-core</code> binary via the command line for headless operation and Bash/PowerShell scripting.
      </p>

      <h2>Basic Commands</h2>
      <p>Ensure the <code>tunnely</code> executable is within your system's PATH. On Linux, this is handled automatically during the <code>.deb</code> installation.</p>

      <div className="space-y-6 mt-8">
        {/* Command 1 */}
        <div className="border border-white/[0.08] bg-[#0A0A0A] p-4 font-mono text-sm max-w-full overflow-x-auto">
          <div className="text-white mb-2"><code>tunnely connect [region]</code></div>
          <p className="text-text-dim text-xs m-0">Initiates the cryptographic handshake and establishes the virtual routing interface. Optionally accepts a targeted region code (e.g. <code>us-east</code>). If omitted, connects to the optimal geographic node.</p>
        </div>

        {/* Command 2 */}
        <div className="border border-white/[0.08] bg-[#0A0A0A] p-4 font-mono text-sm max-w-full overflow-x-auto">
          <div className="text-white mb-2"><code>tunnely disconnect</code></div>
          <p className="text-text-dim text-xs m-0">Gracefully tears down the WireGuard tunnel and restores the operating system's default routing gateway, avoiding DNS leaks.</p>
        </div>

        {/* Command 3 */}
        <div className="border border-white/[0.08] bg-[#0A0A0A] p-4 font-mono text-sm max-w-full overflow-x-auto">
          <div className="text-white mb-2"><code>tunnely status</code></div>
          <p className="text-text-dim text-xs m-0">Returns a JSON-formatted payload of the current daemon state, including connected relays, elapsed latency, bytes transferred, and active IP assigned.</p>
        </div>
        
        {/* Command 4 */}
        <div className="border border-white/[0.08] bg-[#0A0A0A] p-4 font-mono text-sm max-w-full overflow-x-auto">
          <div className="text-white mb-2"><code>tunnely auth login</code></div>
          <p className="text-text-dim text-xs m-0">Generates a unique OAuth device-code flow URL out to the console. Follow the URL in any web browser to authenticate the headless instance against your active subscription.</p>
        </div>
      </div>

      <h2 className="mt-12">Scripting Integration</h2>
      <p>
        Because commands like <code>status</code> output strictly structured JSON, they can be easily piped into tools like <code>jq</code> for automated health monitoring scripts.
      </p>
      
      <pre>
        <code>
{`# Check if daemon is routing traffic
if [ "$(tunnely status | jq -r .state)" == "connected" ]; then
    echo "Mesh routing active."
else
    echo "Warning: connection dropped. Reinitializing..."
    tunnely connect
fi`}
        </code>
      </pre>

    </div>
  );
}
