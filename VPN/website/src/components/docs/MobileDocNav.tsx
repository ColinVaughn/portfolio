"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { DocsSidebar } from "./DocsSidebar";

export function MobileDocNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 border-b border-white/[0.08] bg-[#0A0A0A] text-text"
      >
        <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
          Docs Navigation
        </span>
        {open ? <X className="w-5 h-5 text-text-dim" /> : <Menu className="w-5 h-5 text-text-dim" />}
      </button>

      {/* Collapsible sidebar */}
      {open && (
        <div
          className="fixed inset-0 top-[calc(4rem+49px)] z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-72 h-full bg-[#0A0A0A] border-r border-white/[0.08] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close on link click */}
            <div onClick={() => setOpen(false)}>
              <DocsSidebar />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
