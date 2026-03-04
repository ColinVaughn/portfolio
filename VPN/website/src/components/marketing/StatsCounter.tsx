"use client";

import { motion } from "framer-motion";

const stats = [
  { value: "2,400+", label: "Global Servers", desc: "Distributed across 94 countries." },
  { value: "12ms", label: "Avg Latency", desc: "Ultra-low latency edge routing." },
  { value: "99.99%", label: "Network Uptime", desc: "Tier-4 data center redundancy." },
  { value: "40Gbps", label: "Node Capacity", desc: "Unthrottled fiber-optic backbone." },
];

export function StatsCounter() {
  return (
    <section className="py-24 bg-[#121212] border-y border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header Section */}
        <div className="mb-16 border-b border-white/[0.08] pb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
              Engineered for Zero-Knowledge Performance.
            </h2>
            <p className="text-text-dim/80 text-sm md:text-base font-mono">
              Real-time performance telemetry across the Tunnely multi-hop fabric. Metrics refreshed every 300ms.
            </p>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 border border-primary/30 bg-primary/5 rounded-sm">
            <span className="w-1.5 h-1.5 bg-primary animate-pulse rounded-full" />
            <span className="font-mono text-xs text-primary uppercase tracking-widest">
              Global Mesh Network Active
            </span>
          </div>
        </div>

        {/* Technical Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-white/[0.08] border border-white/[0.08]">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="bg-[#121212] p-8 md:p-10 flex flex-col"
            >
              <div className="font-mono text-4xl md:text-5xl font-bold text-white mb-4 tracking-tighter">
                {stat.value}
              </div>
              <div className="text-base font-bold text-text mb-2 uppercase tracking-wide">
                {stat.label}
              </div>
              <div className="text-sm text-text-dim mt-auto">
                {stat.desc}
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Footer Technical readout */}
        <div className="mt-8 flex justify-end">
             <span className="font-mono text-[10px] text-text-dim/50 uppercase tracking-[0.2em] border-b border-white/[0.04] pb-1">
                 EST_RELAY_STABILITY: 99.8%
             </span>
        </div>

      </div>
    </section>
  );
}
