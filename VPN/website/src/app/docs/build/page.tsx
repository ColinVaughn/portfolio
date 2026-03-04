import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Building from Source | Tunnely Docs",
  description: "Learn how to fork, clone, and compile the Tunnely client interface and Rust relay daemons from raw source code. Full build environment instructions.",
  keywords: ["tunnely source code", "build tunnely from source", "compile tauri app", "compile rust daemon", "tunnely developers"],
  openGraph: {
    title: "Building from Source | Tunnely Docs",
    description: "Learn how to fork, clone, and compile the Tunnely client interface and Rust relay daemons from raw source code. Full build environment instructions.",
    url: "/docs/build",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Compile Tunnely from Source",
    description: "Full build environment setup for compiling the client and daemon.",
  }
};

export default function BuildDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        Building from <span className="text-primary">Source</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        A zero-knowledge privacy network inherently cannot operate on trust. We open source our interfaces, our routing daemon, and our mesh networking topologies.
      </p>

      <h2>Prerequisites</h2>
      <p>
        Before attempting to compile the desktop client or the network daemon, ensure your build environment contains the following tools:
      </p>
      <ul>
        <li><a href="https://rustup.rs/" className="text-primary hover:underline">Rust and Cargo</a> (Stable Toolchain)</li>
        <li><a href="https://nodejs.org/" className="text-primary hover:underline">Node.js</a> (v18+)</li>
        <li><code>gcc</code> or clang (C Compiler for native dependencies)</li>
        <li>Tauri Prerequisites (libwebkit2gtk-4.1-dev on Linux, MSVC C++ build tools on Windows)</li>
      </ul>

      <h2>Compiling the Desktop Client</h2>
      <p>
        The Tunnely desktop client is a standard Tauri application. The frontend UI is written in Next.js/React, which invokes the local Rust IPC bindings to control the underlying daemon.
      </p>
      
      <div className="border border-white/[0.08] bg-[#0A0A0A] p-4 font-mono text-sm max-w-full overflow-x-auto mt-6">
        <pre className="!bg-transparent !p-0 !m-0 border-0 text-text-dim">
{`# 1. Clone the repository
git clone https://github.com/tunnely/tunnely-client.git
cd tunnely-client/client-app

# 2. Install JavaScript UI dependencies
npm install

# 3. Build and launch the development GUI
npm run tauri dev`}
        </pre>
      </div>

      <p className="mt-8">
        To produce a signed release executable for your specific OS (e.g. an <code>.msi</code> or <code>.dmg</code>), execute the build pipeline:
      </p>

      <div className="border border-white/[0.08] bg-[#0A0A0A] p-4 font-mono text-sm max-w-full overflow-x-auto mt-6">
        <pre className="!bg-transparent !p-0 !m-0 border-0 text-text-dim">
{`npm run tauri build`}
        </pre>
      </div>

      <h2>Compiling the Relay Server</h2>
      <p>
        If you wish to audit the mesh networking protocol or inspect the cryptographic endpoints, you must compile the headless <code>relay-server</code>.
      </p>

      <div className="border border-white/[0.08] bg-[#0A0A0A] p-4 font-mono text-sm max-w-full overflow-x-auto mt-6 mb-12">
        <pre className="!bg-transparent !p-0 !m-0 border-0 text-text-dim">
{`# 1. Clone the repository
git clone https://github.com/tunnely/tunnely-relay.git
cd tunnely-relay/relay-core

# 2. Compile the optimized release binary
cargo build --release

# 3. The executable will be deposited in target/release/
./target/release/tunnely-relay --help`}
        </pre>
      </div>
    </div>
  );
}
