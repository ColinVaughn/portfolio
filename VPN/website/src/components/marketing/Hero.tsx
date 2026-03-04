"use client";

import { PrefetchLink as Link } from "@/components/ui/PrefetchLink";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Download, Activity, Shield, Network } from "lucide-react";
import { motion } from "framer-motion";
import { NetworkGlobe } from "./NetworkGlobe";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-background">
      {/* Subtle grid background for structural feel */}
      <div className="absolute inset-0 bg-grid opacity-10" />

      <div className="relative max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* Left: Text */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-start"
        >

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.0] tracking-tight mb-8 text-text">
            Multi-Hop
            <br />
            VPN Network.
            <br />
            Unbreakable
            <br />
            Privacy.
          </h1>

          <p className="text-lg text-text-dim leading-relaxed max-w-lg mb-10 border-l-2 border-primary/20 pl-4">
            Route your traffic through multiple encrypted relays. Bond your
            connections for speed. No single server ever sees the full picture.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link href="/download" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 rounded-sm shadow-none font-bold tracking-wide">
                <Download className="w-5 h-5 mr-2" />
                INITIATE TUNNEL
              </Button>
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto h-14 px-8 rounded-sm border-2 border-border shadow-none font-bold tracking-wide bg-transparent hover:bg-surface-50">
                VIEW PRICING
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Core Guarantees Technical Display */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 pt-8 border-t border-border w-full">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="w-4 h-4" />
                <span className="font-mono text-xs tracking-wider uppercase font-bold">Policy</span>
              </div>
              <span className="text-text-dim text-sm">Absolute Zero-logs</span>
            </div>
            <div className="flex flex-col gap-1">
               <div className="flex items-center gap-2 text-primary">
                <Activity className="w-4 h-4" />
                <span className="font-mono text-xs tracking-wider uppercase font-bold">Protocol</span>
              </div>
              <span className="text-text-dim text-sm">Kernel WireGuard</span>
            </div>
             <div className="flex flex-col gap-1">
               <div className="flex items-center gap-2 text-primary">
                <Network className="w-4 h-4" />
                <span className="font-mono text-xs tracking-wider uppercase font-bold">Nodes</span>
              </div>
              <span className="text-text-dim text-sm">Open-source Relays</span>
            </div>
          </div>
        </motion.div>

        {/* Right: Globe visualization */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="hidden lg:flex items-center justify-center relative"
        >
            {/* Architectural Frame for Globe */}
            <div className="absolute inset-x-[-10%] inset-y-[-10%] border border-border/30 rounded-full border-dashed pointer-events-none" />
            <div className="absolute inset-x-[5%] inset-y-[5%] border border-border/10 rounded-full border-dotted pointer-events-none" />
            <NetworkGlobe />
        </motion.div>
      </div>
    </section>
  );
}
