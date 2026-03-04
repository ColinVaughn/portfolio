import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Daemon Configuration & JSON | Tunnely Docs",
  description: "Comprehensive guide to configuring your local Tunnely daemon and DNS-level adblock engine via the headless JSON manifesto. Customize your network routing.",
  keywords: ["tunnely configuration", "vpn daemon settings", "vpn json config", "adblock proxy engine", "client configuration", "tunnely dns settings"],
  openGraph: {
    title: "Client Daemon Configuration & JSON | Tunnely Docs",
    description: "Comprehensive guide to configuring your local Tunnely daemon and DNS-level adblock engine via the headless JSON manifesto. Customize your network routing.",
    url: "/docs/configuration",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely Daemon Configuration | Headless JSON",
    description: "Learn how to programmatically control your Tunnely routing daemon.",
  }
};

export default function ConfigDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Daemon <span className="text-primary">Configuration</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        The Tunnely desktop application stores its local configuration preferences in a JSON file. The headless Rust daemon reads this file to dictate channel bonding limits and start-up behaviour.
      </p>

      <h2>Manifest Location</h2>
      <p>
        The daemon configuration is stored in a standard JSON file scoped to the current user profile's application data directory.
      </p>
      <ul>
        <li><strong>Windows:</strong> <code>%APPDATA%\com.tunnely.app\tunnely_prefs.json</code></li>
        <li><strong>macOS:</strong> <code>~/Library/Application Support/com.tunnely.app/tunnely_prefs.json</code></li>
        <li><strong>Linux:</strong> <code>~/.config/com.tunnely.app/tunnely_prefs.json</code></li>
      </ul>

      <h2>Available Parameters</h2>

      <div className="overflow-x-auto mt-8 border border-white/[0.08] bg-[#0A0A0A]">
        <table className="w-full text-left font-mono text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] bg-[#121212]">
              <th className="p-4 uppercase tracking-widest text-[#a1a1aa] font-bold text-xs">Parameter</th>
              <th className="p-4 uppercase tracking-widest text-[#a1a1aa] font-bold text-xs">Type</th>
              <th className="p-4 uppercase tracking-widest text-[#a1a1aa] font-bold text-xs">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.08] text-white">
            <tr>
              <td className="p-4"><code>bonding_mode</code></td>
              <td className="p-4 text-primary">String</td>
              <td className="p-4 text-text-dim">Forces the channel bonding strategy. Options: <code>Speed</code>, <code>Reliability</code>, <code>None</code>.</td>
            </tr>
            <tr>
              <td className="p-4"><code>cyberSecEnabled</code></td>
              <td className="p-4 text-primary">Boolean</td>
              <td className="p-4 text-text-dim">Enables the system-wide DNS sinkhole proxy via Brave's Rust adblock engine.</td>
            </tr>
            <tr>
              <td className="p-4"><code>autoConnect</code></td>
              <td className="p-4 text-primary">Boolean</td>
              <td className="p-4 text-text-dim">Automatically connects to the optimal relay network upon daemon launch.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="p-6 border border-yellow-500/30 bg-yellow-500/5 mt-8">
        <h4 className="font-bold text-yellow-500 uppercase tracking-widest text-xs flex items-center gap-2 m-0 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          GUI Override Warning
        </h4>
        <p className="text-sm text-yellow-500/80 m-0">
          The desktop client automatically manages this JSON file. Manual modifications outside of the Tauri commands or React GUI may be overwritten if the application is currently running. Close the application via the system tray before manual editing.
        </p>
      </div>
    </div>
  );
}
