import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Installation Guide | Tunnely Docs",
  description: "Download and install the Tunnely client on Windows, macOS, and Linux. Step-by-step instructions for getting the zero-knowledge privacy daemon running.",
  keywords: ["tunnely installation", "download tunnely vpn", "install vpn client", "tunnely windows", "tunnely macos", "tunnely linux"],
  openGraph: {
    title: "Installation Guide | Tunnely Docs",
    description: "Download and install the Tunnely client on Windows, macOS, and Linux. Step-by-step instructions for getting the zero-knowledge privacy daemon running.",
    url: "/docs/installation",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Install the Tunnely Desktop Client",
    description: "Step-by-step instructions for getting the zero-knowledge privacy daemon running on your machine.",
  }
};

export default function InstallationDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        <span className="text-primary">Installation</span> Guide
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        The Tunnely ecosystem consists of a headless Rust daemon managed by a lightweight React/Tauri desktop interface. Follow the instructions below to install the client securely on your operating system.
      </p>

      <h2>System Requirements</h2>
      <ul>
        <li><strong>Windows:</strong> Windows 10/11 (64-bit)</li>
        <li><strong>macOS:</strong> macOS 11+ (Intel or Apple Silicon)</li>
        <li><strong>Linux:</strong> Ubuntu 20.04+, Fedora 35+, Arch Linux (NetworkManager required)</li>
      </ul>

      <div className="p-6 border border-white/[0.08] bg-[#0A0A0A] mt-8 mb-12">
        <h3 className="m-0 mb-4 uppercase tracking-widest text-[#a1a1aa] text-xs font-bold">Recommended Method: Pre-compiled Binaries</h3>
        <p className="text-sm m-0">
          The easiest way to install Tunnely is to download the latest signed release for your platform from our official <a href="/download" className="text-primary hover:underline">Download</a> page.
        </p>
      </div>

      <h2>Windows Installation</h2>
      <ol>
        <li>Download the <code>.msi</code> installer from the download portal.</li>
        <li>Run the installer and grant explicit Administrator rights (required for the daemon to configure the virtual network interfaces and WireGuard routes).</li>
        <li>Launch "Tunnely" from your Start menu. The app will automatically initialize the headless daemon in the background.</li>
      </ol>

      <h2>macOS Installation</h2>
      <ol>
        <li>Download the universal <code>.dmg</code> file.</li>
        <li>Open the `.dmg` and drag the Tunnely app into your <code>/Applications</code> folder.</li>
        <li>Upon first launch, macOS will prompt you to install a "System Extension" to allow Tunnely to route traffic. Navigate to System Settings &gt; Privacy &amp; Security and explicitly "Allow" the Tunnely extension.</li>
      </ol>

      <h2>Linux Installation</h2>
      <p>
        On Linux, Tunnely interacts directly with <code>NetworkManager</code> and expects <code>resolvconf</code> and <code>wireguard-tools</code> to be available on your system path.
      </p>
      <pre>
        <code>
{`# Debian / Ubuntu Systems
wget https://dl.tunnely.org/tunnely-latest.deb
sudo dpkg -i tunnely-latest.deb
sudo apt-get install -f # to resolve dependencies`}
        </code>
      </pre>

      <div className="p-6 border border-yellow-500/30 bg-yellow-500/5 mt-8">
        <h4 className="font-bold text-yellow-500 uppercase tracking-widest text-xs flex items-center gap-2 m-0 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Warning: Third-Party Repositories
        </h4>
        <p className="text-sm text-yellow-500/80 m-0">
          Do not install Tunnely from unofficial package managers or community mirrors (e.g. AUR packages not maintained by the core team). Due to the nature of network-level routing, compromised binaries could intercept your traffic before cryptography is applied.
        </p>
      </div>
    </div>
  );
}
