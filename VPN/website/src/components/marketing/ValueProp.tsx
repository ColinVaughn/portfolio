"use client";

import { motion } from "framer-motion";
import { Layers, Wifi, ShieldCheck } from "lucide-react";

const pillars = [
  {
    icon: ShieldCheck,
    tag: "VPN",
    title: "Multi-Hop Encrypted VPN",
    description:
      "Your traffic is routed through multiple encrypted relay nodes. No single server ever sees both your identity and your destination.",
  },
  {
    icon: Wifi,
    tag: "BONDING",
    title: "Channel Bonding Engine",
    description:
      "Aggregate Wi-Fi, Ethernet and Cellular simultaneously. Seamless failover and combined throughput  - like Speedify, built into the core.",
  },
  {
    icon: Layers,
    tag: "ADBLOCK",
    title: "System-Level Ad & Tracker Shield",
    description:
      "DNS-layer blocking, HTTPS MITM inspection and cosmetic filtering strip ads, trackers and telemetry before they touch your browser.",
  },
];

export function ValueProp() {
  return (
    <section className="py-24 bg-bg relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-16 border-b border-white/[0.08] pb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-mono text-xs text-primary uppercase tracking-[0.2em] mb-4">
              Beyond a Traditional VPN
            </p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
              Three Systems. One Client.
            </h2>
            <p className="text-text-dim/80 text-sm md:text-base font-mono">
              Tunnely isn&apos;t just a VPN  - it&apos;s a multi-hop privacy
              network, a channel bonding engine, and an advanced ad-blocking
              system, unified in a single native application.
            </p>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 border border-primary/30 bg-primary/5 rounded-sm shrink-0">
            <span className="w-1.5 h-1.5 bg-primary animate-pulse rounded-full" />
            <span className="font-mono text-xs text-primary uppercase tracking-widest">
              All Modules Active
            </span>
          </div>
        </div>

        {/* Pillar Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[1px] bg-white/[0.08] border border-white/[0.08]">
          {pillars.map((pillar, i) => (
            <motion.div
              key={pillar.tag}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.4 }}
              className="bg-[#121212] p-8 md:p-10 flex flex-col group hover:bg-white/[0.02] transition-colors"
            >
              {/* Icon row */}
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 flex items-center justify-center border border-primary/30 bg-primary/5 rounded-sm">
                  <pillar.icon
                    className="w-5 h-5 text-primary"
                    strokeWidth={1.5}
                  />
                </div>
                <span className="font-mono text-[10px] text-primary/60 tracking-[0.25em] font-bold uppercase">
                  {pillar.tag}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-black text-white mb-3 tracking-tight uppercase">
                {pillar.title}
              </h3>
              <p className="text-sm font-mono text-text-dim leading-loose mt-auto">
                {pillar.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Footer readout */}
        <div className="mt-8 flex justify-end">
          <span className="font-mono text-[10px] text-text-dim/50 uppercase tracking-[0.2em] border-b border-white/[0.04] pb-1">
            UNIFIED_CLIENT_MODULES: 3 / 3
          </span>
        </div>
      </div>
    </section>
  );
}
