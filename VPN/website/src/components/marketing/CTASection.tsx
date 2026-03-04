"use client";

import { PrefetchLink as Link } from "@/components/ui/PrefetchLink";
import { ArrowRight, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export function CTASection() {
  return (
    <section className="py-32 bg-[#121212] relative border-t border-white/[0.08]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl mx-auto px-6 text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-primary/30 bg-primary/10 rounded-sm">
           <span className="w-1.5 h-1.5 bg-primary animate-pulse rounded-full" />
           <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
             Network Ready
           </span>
        </div>
        
        <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
          Secure your network today.
        </h2>
        
        <p className="text-lg md:text-xl text-text-dim mb-12 max-w-2xl mx-auto font-mono">
          Experience multi-hop encryption and uncompromising speed. No logs, no limits, no compromises.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/pricing" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
              Get Tunnely Pro
              <ArrowRight className="w-4 h-4" strokeWidth={3} />
            </button>
          </Link>
          <Link href="/docs" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/[0.15] text-white font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-white/[0.05] transition-colors">
              <BookOpen className="w-4 h-4" strokeWidth={2} />
              View Documentation
            </button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
