import Link from "next/link";
import { ChevronRight } from "lucide-react";

const DOCS_NAV = [
  {
    title: "Getting Started",
    items: [
      { label: "Introduction", href: "/docs" },
      { label: "Installation", href: "/docs/installation" },
      { label: "Quick Start", href: "/docs/quick-start" },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      { label: "Zero-Knowledge Architecture", href: "/docs/architecture" },
      { label: "Relay Network", href: "/docs/relay-network" },
      { label: "Channel Bonding", href: "/docs/channel-bonding" },
      { label: "Anti-Censorship", href: "/docs/anti-censorship" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Client CLI", href: "/docs/cli" },
      { label: "Daemon Settings", href: "/docs/configuration" },
      { label: "Adblock Engine", href: "/docs/adblock" },
    ],
  },
  {
    title: "Developers",
    items: [
      { label: "API Reference", href: "/docs/api" },
      { label: "Building from Source", href: "/docs/build" },
      { label: "Contributing", href: "/docs/contributing" },
    ],
  },
];

export function DocsSidebar() {
  return (
    <aside className="h-full bg-bg font-mono text-sm border-r border-white/[0.08]">
      <div className="p-6 border-b border-white/[0.08]">
        <h2 className="font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <span className="w-2 h-2 bg-primary animate-pulse-glow" />
          Documentation
        </h2>
      </div>

      <nav className="p-6 space-y-8 overflow-y-auto max-h-[calc(100vh-80px)]">
        {DOCS_NAV.map((section) => (
          <div key={section.title}>
            <h3 className="text-text-dim uppercase tracking-wider text-[11px] font-bold mb-3 border-l-2 border-primary/30 pl-3">
              {section.title}
            </h3>
            <ul className="space-y-1 pl-3">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center text-text hover:text-primary transition-colors py-1.5"
                  >
                    <ChevronRight className="w-3 h-3 opacity-0 -ml-3 group-hover:opacity-100 group-hover:ml-0 transition-all text-primary" />
                    <span className="group-hover:translate-x-1 transition-transform">
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
