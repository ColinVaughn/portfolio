import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quick Start Guide | Tunnely Docs",
  description: "Connect to the Tunnely zero-knowledge network in under 60 seconds. Learn how to launch the client, authenticate, and verify your mesh routing status.",
  keywords: ["tunnely quick start", "how to use tunnely", "connect to tunnely", "vpn tutorial", "zero-knowledge routing setup"],
  openGraph: {
    title: "Quick Start Guide | Tunnely Docs",
    description: "Connect to the Tunnely zero-knowledge network in under 60 seconds. Learn how to launch the client, authenticate, and verify your mesh routing status.",
    url: "/docs/quick-start",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely Quick Start Guide",
    description: "Connect to the decentralized zero-knowledge mesh in under 60 seconds.",
  }
};

export default function QuickStartDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        <span className="text-primary">Quick</span> Start
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        You've installed the client. Now it's time to route your traffic through the decentralized mesh. This guide will get you connected in under 60 seconds.
      </p>

      <h2>1. Launch and Authenticate</h2>
      <p>
        Open the Tunnely desktop application. On initial launch, you will be prompted to authenticate. Because we operate a zero-knowledge infrastructure, logging in does not tie your network traffic to your identity -it solely validates your active subscription tier with the central cluster to prevent network abuse.
      </p>
      <ul>
        <li>Click <strong>Connect with Provider</strong> in the dashboard.</li>
        <li>Your default web browser will open to handle a secure OAuth transaction.</li>
        <li>Once successful, the browser will seamlessly deep-link the authorization token back into the desktop client.</li>
      </ul>

      <h2>2. Initialize the Connection</h2>
      <p>
        In the center of the UI, you will see a large, distinct <strong>Connect</strong> button. Before clicking it, you can optionally select a geographic region. By default, Tunnely will construct an optimal latency-focused path utilizing the nearest available entry node.
      </p>
      <p>
        Click the Connect button. The daemon will instantly:
      </p>
      <ol>
        <li>Negotiate a cryptographic handshake with the closest Entry Relay.</li>
        <li>Request the optimal server-to-server mesh path to an Exit Relay.</li>
        <li>Apply the local WireGuard routing tables to your operating system via virtual interfaces.</li>
      </ol>

      <div className="p-6 border border-white/[0.08] bg-[#0A0A0A] mt-8 mb-12">
        <h3 className="m-0 mb-4 uppercase tracking-widest text-green-500 text-xs font-bold">Status: Connected</h3>
        <p className="text-sm m-0 text-text-dim">
          When the central hub pulses green and displays "Connected," your physical IP address is now obfuscated. All system-wide traffic is being routed into the entry node and spat out of the exit node.
        </p>
      </div>

      <h2>3. Verify the Route</h2>
      <p>
        To ensure the topology is functioning correctly, navigate to an IP-checking service (such as <code>ifconfig.me</code> or <code>ipleak.net</code>) in your browser. 
      </p>
      <p>
        You should observe that:
      </p>
      <ul>
        <li>Your IP address completely differs from your home ISP address.</li>
        <li>Your location corresponds to the Exit node's geography.</li>
        <li>There are no DNS leaks (Tunnely forces all DNS requests through its internal sinkhole/resolver proxy).</li>
      </ul>
    </div>
  );
}
