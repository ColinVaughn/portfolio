import { cn } from "@/lib/utils/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("w-6 h-6", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 
        Hexagonal node network representing Tunnely's 3 core systems
        funneling into a unified client routing layer.
        
        Top 3 nodes = the 3 services (white)
        Bottom 3 nodes = the unified client (primary blue)
        Hexagonal frame = the encrypted perimeter
      */}

      {/* Hexagonal perimeter frame */}
      <polygon
        points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5"
        className="stroke-white"
        strokeWidth="3"
        strokeLinejoin="miter"
      />

      {/* Internal routing lines (dashed telemetry) */}
      <line x1="50" y1="5" x2="50" y2="95" className="stroke-white/30" strokeWidth="1.5" strokeDasharray="4 4" />
      <line x1="7" y1="27.5" x2="93" y2="72.5" className="stroke-white/30" strokeWidth="1.5" strokeDasharray="4 4" />
      <line x1="93" y1="27.5" x2="7" y2="72.5" className="stroke-white/30" strokeWidth="1.5" strokeDasharray="4 4" />

      {/* ═══ TOP NODE: Multi-Hop VPN (Shield) ═══ */}
      <g transform="translate(50,5)">
        <circle cx="0" cy="0" r="9" className="fill-white" />
        {/* Minimal shield glyph */}
        <path d="M0,-5 L-4,-2.5 V1 C-4,3.5 -1,5.5 0,6 C1,5.5 4,3.5 4,1 V-2.5 Z" className="fill-[#121212]" />
      </g>

      {/* ═══ TOP-LEFT NODE: Channel Bonding (Parallel Bars) ═══ */}
      <g transform="translate(7,27.5)">
        <circle cx="0" cy="0" r="9" className="fill-white" />
        {/* 3 parallel vertical bars */}
        <line x1="-3.5" y1="-4" x2="-3.5" y2="4" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
        <line x1="3.5" y1="-4" x2="3.5" y2="4" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* ═══ TOP-RIGHT NODE: Adblock (Circle-Slash) ═══ */}
      <g transform="translate(93,27.5)">
        <circle cx="0" cy="0" r="9" className="fill-white" />
        <circle cx="0" cy="0" r="5" fill="none" stroke="#121212" strokeWidth="1.5" />
        <line x1="-3.5" y1="3.5" x2="3.5" y2="-3.5" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* ═══ BOTTOM 3 NODES: Unified Client (Primary Blue) ═══ */}
      <circle cx="50" cy="95" r="9" className="fill-primary" />
      <circle cx="7" cy="72.5" r="9" className="fill-primary" />
      <circle cx="93" cy="72.5" r="9" className="fill-primary" />

      {/* Active tunnel path highlight (bottom V) */}
      <line x1="7" y1="72.5" x2="50" y2="95" className="stroke-primary" strokeWidth="2.5" />
      <line x1="93" y1="72.5" x2="50" y2="95" className="stroke-primary" strokeWidth="2.5" />
    </svg>
  );
}
