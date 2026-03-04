import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { InteractiveGlobe } from "@/components/marketing/InteractiveGlobe";
import { Server, Activity, Users, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Global Infrastructure",
  description:
    "Explore Tunnely's decentralized mesh of bare-metal WireGuard relay nodes. Every server runs in RAM with zero-logging and is continuously audited.",
  keywords: ["VPN servers", "relay network", "WireGuard nodes", "bare-metal VPN", "server status", "tunnely infrastructure", "zero-logging VPN"],
  openGraph: {
    title: "Global Infrastructure | Tunnely",
    description:
      "Live status of our decentralized WireGuard relay network. Bare-metal nodes, zero-logging, RAM-only operation.",
    url: "/infrastructure",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Global Infrastructure | Tunnely",
    description: "Live status of our decentralized WireGuard relay network.",
  },
};

export const revalidate = 60; // Revalidate every 60 seconds

export default async function InfrastructurePage() {
  const supabase = await createClient();
  
  // Fetch active relays
  const { data: servers, error } = await supabase
    .from("relay_servers")
    .select("*")
    .in("status", ["online", "degraded"])
    .order("region", { ascending: true })
    .order("country_code", { ascending: true });

  const activeServers = servers || [];
  
  // Aggregate stats
  const totalCapacity = activeServers.reduce((acc, s) => acc + s.max_clients, 0);
  const currentLoad = activeServers.reduce((acc, s) => acc + s.current_clients, 0);
  const loadPercentage = totalCapacity > 0 ? ((currentLoad / totalCapacity) * 100).toFixed(1) : 0;

  return (
    <>
      {/* Hero Section */}
      <section className="py-24 relative overflow-hidden bg-[#121212] border-b border-white/[0.08]">
         <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
         
         <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center pt-8">
            <div className="flex flex-col relative z-10">
               <h1 className="text-4xl md:text-6xl font-black mb-6 uppercase tracking-tight text-white leading-[1.1]">
                 Global <br /> <span className="text-primary">Infrastructure</span>
               </h1>
               <p className="text-sm font-mono text-text-dim max-w-lg leading-loose uppercase tracking-widest mb-10">
                 Explore our decentralized mesh of bare-metal WireGuard relays. Every node runs purely in RAM and is constantly audited to ensure strict zero-logging compliance.
               </p>

               {/* Quick Stats */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] border border-white/[0.08] p-4 flex flex-col">
                     <span className="font-mono text-[10px] text-text-dim/60 uppercase tracking-widest mb-1">Active Nodes</span>
                     <span className="font-bold text-2xl text-white font-mono">{activeServers.length}</span>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.08] p-4 flex flex-col">
                     <span className="font-mono text-[10px] text-text-dim/60 uppercase tracking-widest mb-1">Global Load</span>
                     <span className="font-bold text-2xl text-primary font-mono">{loadPercentage}%</span>
                  </div>
               </div>
            </div>

            <div className="flex justify-center items-center relative z-10">
               <InteractiveGlobe servers={activeServers as any} />
            </div>
         </div>
      </section>

      {/* Operations Header */}
      <section className="py-12 bg-bg border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
             <Activity className="text-primary w-6 h-6" />
             Live Node Readout
          </h2>
          <p className="mt-4 text-sm font-mono text-text-dim max-w-2xl leading-loose tracking-widest uppercase">
            Real-time telemetry and capacity metrics for all active WireGuard and QUIC endpoints worldwide.
          </p>
        </div>
      </section>

      {/* Roster Grid */}
      <section className="py-16 bg-[#121200]/[0.01]">
         <div className="max-w-7xl mx-auto px-6">
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[1px] bg-white/[0.08] border border-white/[0.08]">
                {activeServers.map((server, i) => (
                   <li key={server.id} className="bg-[#121212] p-8 hover:bg-white/[0.02] transition-colors relative group">
                      
                      {/* Status indicator */}
                      <div className="absolute top-8 right-8 flex items-center gap-2">
                         <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim/60 group-hover:text-text-dim transition-colors">
                            {server.status}
                         </span>
                         <span className={`w-2 h-2 rounded-full ${server.status === 'online' ? 'bg-primary' : 'bg-red-500'} animate-pulse`} />
                      </div>

                      {/* Header */}
                      <div className="flex items-center gap-3 mb-6">
                         <div className="w-10 h-10 bg-white/[0.02] border border-white/[0.08] flex items-center justify-center">
                            <Server className="w-5 h-5 text-white/50" />
                         </div>
                         <div className="flex flex-col">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">{server.city}</h3>
                            <span className="font-mono text-[10px] text-primary uppercase tracking-widest">{server.region} • {server.country_code}</span>
                         </div>
                      </div>

                      {/* Metrics */}
                      <div className="space-y-4 font-mono text-xs text-text-dim uppercase tracking-wider bg-white/[0.01] border border-white/[0.04] p-4">
                         <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
                            <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Connections</span>
                            <span className="text-white font-bold">{server.current_clients} / {server.max_clients}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
                            <span className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Port (WG)</span>
                            <span className="text-white">{server.wireguard_port}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
                            <span className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Port (QUIC)</span>
                            <span className="text-white">{server.quic_port}</span>
                         </div>
                         <div className="flex justify-between items-center pt-1">
                            <span>Hostname</span>
                            <span className="text-white text-right truncate max-w-[120px]" title={server.hostname}>
                                {server.hostname.split('.')[0]}
                            </span>
                         </div>
                      </div>
                   </li>
                ))}
                
                {activeServers.length === 0 && (
                   <li className="bg-[#121212] p-12 col-span-full flex justify-center flex-col items-center">
                       <Server className="w-12 h-12 text-white/20 mb-4" />
                       <p className="font-mono text-text-dim uppercase tracking-widest">No active relays detected in registry.</p>
                   </li>
                )}
            </ul>
         </div>
      </section>
    </>
  );
}
