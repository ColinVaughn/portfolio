import Link from "next/link";
import { ServerOff, Shield, Route, Home } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BrokenGlobe } from "@/components/marketing/BrokenGlobe";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <div className="min-h-[90vh] flex flex-col items-center justify-center bg-[#121212] p-6 pt-32 pb-24 overflow-hidden relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center w-full max-w-7xl mx-auto z-10">
          
          {/* Left Column: Text Content */}
          <div className="flex flex-col">
            {/* Error Header */}
            <div className="border border-white/[0.08] bg-white/[0.02] p-8 md:p-12 mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#ef4444]" />
              <ServerOff className="w-12 h-12 text-[#ef4444] mb-6 opacity-80" strokeWidth={1.5} />
              <h1 className="text-6xl md:text-8xl font-black text-white mb-2 uppercase tracking-tight leading-none">404</h1>
              <h2 className="text-xl md:text-2xl font-mono text-[#ef4444] font-bold uppercase tracking-widest mb-4">Tunnel Dead End</h2>
              <p className="text-sm md:text-base font-mono text-text-dim leading-relaxed">
                The encrypted path you requested does not exist in our routing table. Traffic has been dropped.
              </p>
            </div>

            {/* About Service Context */}
            <div className="mb-10 p-6 border border-white/[0.04] bg-white/[0.01]">
              <p className="text-[11px] font-mono text-text-dim/80 uppercase tracking-widest leading-loose">
                <strong className="text-white">Relay Framework Offline:</strong> This node is unreachable. Tunnely routing algorithms dynamically shift traffic away from dead nodes using Speedify-class channel bonding and WireGuard encryption.
              </p>
            </div>

            {/* Useful Links Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/" className="group border border-white/[0.08] bg-white/[0.02] p-6 hover:bg-white/[0.06] hover:border-white/[0.15] transition-all flex flex-col items-center text-center">
                <Home className="w-5 h-5 text-text-dim group-hover:text-primary mb-3 transition-colors" strokeWidth={1.5} />
                <span className="font-mono text-[11px] font-bold text-white uppercase tracking-widest mb-1">Return Base</span>
              </Link>
              
              <Link href="/features" className="group border border-white/[0.08] bg-white/[0.02] p-6 hover:bg-white/[0.06] hover:border-white/[0.15] transition-all flex flex-col items-center text-center">
                <Shield className="w-5 h-5 text-text-dim group-hover:text-primary mb-3 transition-colors" strokeWidth={1.5} />
                <span className="font-mono text-[11px] font-bold text-white uppercase tracking-widest mb-1">Security</span>
              </Link>

              <Link href="/dashboard" className="group border border-white/[0.08] bg-white/[0.02] p-6 hover:bg-white/[0.06] hover:border-white/[0.15] transition-all flex flex-col items-center text-center">
                <Route className="w-5 h-5 text-text-dim group-hover:text-primary mb-3 transition-colors" strokeWidth={1.5} />
                <span className="font-mono text-[11px] font-bold text-white uppercase tracking-widest mb-1">Dashboard</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Broken Globe */}
          <div className="hidden lg:flex items-center justify-center relative">
             {/* Architectural Frame for Globe */}
             <div className="absolute w-[600px] h-[600px] border border-[#ef4444]/20 rounded-full border-dashed pointer-events-none animate-[spin_60s_linear_infinite]" />
             <div className="absolute w-[450px] h-[450px] border border-[#ef4444]/10 rounded-full border-dotted pointer-events-none" />
             <BrokenGlobe />
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}
