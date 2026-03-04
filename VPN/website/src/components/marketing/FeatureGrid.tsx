"use client";

import { motion } from "framer-motion";
import {
  Cpu,
  ShieldAlert,
  HardDriveDownload,
  WifiOff,
  SearchX,
  Laptop
} from "lucide-react";

const features = [
  {
    icon: Cpu,
    title: "Kernel WireGuard",
    description: "Integrated at the OS level for maximum throughput and ultra-low latency across all global hops.",
  },
  {
    icon: ShieldAlert,
    title: "Zero-Trust HTTPS Proxy",
    description: "Local MITM interception with OS Root CA installation to strip trackers and cosmetic ad payloads before they reach the browser.",
  },
  {
    icon: HardDriveDownload,
    title: "Zero-logs Policy",
    description: "RAM-only relay infrastructure ensures no data is ever written to disk and is fully auditable.",
  },
  {
    icon: WifiOff,
    title: "OS-Level Kill Switch",
    description: "Instant network disconnection at the kernel level to prevent accidental IP leaks during connection drops or hardware changes.",
  },
  {
    icon: SearchX,
    title: "CNAME Uncloaking DNS",
    description: "Server-side DNS resolution that exposes hidden trackers masquerading under first-party domains.",
  },
  {
    icon: Laptop,
    title: "Multi-Platform Tauri Core",
    description: "Native high-performance Rust clients available for Linux, macOS, and Windows with system tray integration.",
  },
];

export function FeatureGrid() {
  return (
    <section className="py-24 bg-bg relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 border-b border-white/[0.08] pb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight uppercase">
            Engineered for Privacy and Ultimate Speed
          </h2>
          <p className="text-text-dim text-sm max-w-2xl font-mono uppercase tracking-widest leading-loose">
            Experience the next generation of multi-hop VPN technology with specialized core features built directly into our rust infrastructure.
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/[0.08] border border-white/[0.08]">
          {features.map((feature, i) => (
            <motion.li
              key={feature.title}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="bg-[#121212] p-8 flex flex-col group hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center justify-between mb-6">
                 <feature.icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                 <span className="font-mono text-[10px] text-text-dim/40 tracking-widest font-bold">
                     {String(i + 1).padStart(2, '0')}
                 </span>
              </div>
              <h3 className="text-lg font-black text-white mb-3 tracking-tight uppercase">
                {feature.title}
              </h3>
              <p className="text-sm font-mono text-text-dim leading-loose">
                {feature.description}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
