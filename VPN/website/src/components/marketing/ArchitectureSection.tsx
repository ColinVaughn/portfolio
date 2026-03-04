import { Terminal, Shield, Cpu, Activity, Zap, Database } from "lucide-react";

export function ArchitectureSection() {
  return (
    <section className="py-24 bg-[#121212] border-t border-white/[0.08] relative overflow-hidden">
      {/* Background Architectural Grid Elements */}
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-1/2 w-px h-full bg-white/[0.04] pointer-events-none hidden lg:block" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="mb-20 text-center max-w-3xl mx-auto">
           <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase mb-6">
             Open-Source Rust Architecture
           </h2>
           <p className="text-sm font-mono text-text-dim uppercase tracking-widest leading-loose">
             Tunnely is built from the ground up in Rust. From the native Tauri desktop client to the Tokio-powered bare-metal relay servers, every component prioritizes zero-cost abstractions, memory safety, and maximum throughput.
           </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          
          {/* Client Architecture Pane */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-8 border-b border-primary/30 pb-4">
              <Terminal className="w-6 h-6 text-primary" strokeWidth={1.5} />
              <h3 className="text-xl font-black text-white uppercase tracking-widest">
                Tauri Client Stack
              </h3>
            </div>
            
            <p className="text-sm font-mono text-text-dim leading-loose mb-10">
              A lightweight, native desktop application that avoids memory-heavy Electron frameworks payload. Operates silently in the system tray while controlling root-level networking features.
            </p>

            <div className="flex flex-col gap-6">
              {/* Feature 1 */}
              <div className="bg-white/[0.02] border border-white/[0.08] p-6 hover:bg-white/[0.04] transition-colors group">
                 <div className="flex items-center gap-3 mb-3">
                    <Shield className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                    <span className="font-bold text-white uppercase tracking-tight text-sm">OS-Level Failsafe</span>
                 </div>
                 <p className="text-xs font-mono text-text-dim leading-relaxed">
                   Kernel-level kill switch that dynamically manipulates native firewall rules (Windows Filtering Platform, pf, or iptables) to instantly drop packets upon connection loss.
                 </p>
              </div>

               {/* Feature 2 */}
              <div className="bg-white/[0.02] border border-white/[0.08] p-6 hover:bg-white/[0.04] transition-colors group">
                 <div className="flex items-center gap-3 mb-3">
                    <Activity className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                    <span className="font-bold text-white uppercase tracking-tight text-sm">Zero-Trust MITM Proxy</span>
                 </div>
                 <p className="text-xs font-mono text-text-dim leading-relaxed">
                   Installs an ephemeral Root CA into the system trust store to intercept local HTTPS traffic, stripping cosmetic tracker payloads and forcing deep QUIC rollbacks.
                 </p>
              </div>
            </div>
          </div>

          {/* Relay Architecture Pane */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-8 border-b border-primary/30 pb-4">
              <Database className="w-6 h-6 text-primary" strokeWidth={1.5} />
              <h3 className="text-xl font-black text-white uppercase tracking-widest">
                Tokio Relay Core
              </h3>
            </div>
            
            <p className="text-sm font-mono text-text-dim leading-loose mb-10">
              Asynchronous, event-driven bare-metal servers designed for extreme concurrency. Eliminates context switching bottlenecks to forward packets across the global mesh instantly.
            </p>

            <div className="flex flex-col gap-6">
               {/* Feature 1 */}
               <div className="bg-white/[0.02] border border-white/[0.08] p-6 hover:bg-white/[0.04] transition-colors group">
                 <div className="flex items-center gap-3 mb-3">
                    <Zap className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                    <span className="font-bold text-white uppercase tracking-tight text-sm">WireGuard / Noise Protocol</span>
                 </div>
                 <p className="text-xs font-mono text-text-dim leading-relaxed">
                   Strictly enforces Curve25519 key exchange and ChaCha20-Poly1305 AEAD. Client subnets are segregated with internal 10.0.0.0/16 routing using zero-copy `nftables` forwarding.
                 </p>
              </div>

               {/* Feature 2 */}
               <div className="bg-white/[0.02] border border-white/[0.08] p-6 hover:bg-white/[0.04] transition-colors group">
                 <div className="flex items-center gap-3 mb-3">
                    <Cpu className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                    <span className="font-bold text-white uppercase tracking-tight text-sm">DNS Cloaking Mitigation</span>
                 </div>
                 <p className="text-xs font-mono text-text-dim leading-relaxed">
                   Dedicated DnsProxy layer intercepts egress requests, utilizing backend caches and CNAME uncloaking algorithms to null-route requests masking behind first-party domains.
                 </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
