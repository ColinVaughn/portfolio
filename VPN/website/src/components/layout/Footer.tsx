"use client";

import { PrefetchLink as Link } from "@/components/ui/PrefetchLink";

const footerSections = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/download", label: "Download" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog?category=product", label: "Updates" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy-policy", label: "Privacy Policy" },
      { href: "/legal/terms-of-service", label: "Terms of Service" },
      { href: "/accessibility", label: "Accessibility" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/blog?category=guides", label: "Guides" },
      { href: "mailto:support@tunnely.com", label: "Contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#121212]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8 mb-12 text-center md:text-left">
          {/* Brand */}
          <div className="col-span-1 sm:col-span-2 md:col-span-1 flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-4 group">
              <div className="w-2 h-2 bg-primary rounded-none" />
              <span className="text-[17px] font-black text-white tracking-tight uppercase">
                Tunnely
              </span>
            </div>
            <p className="text-xs text-text-dim leading-relaxed max-w-[200px] font-mono uppercase tracking-widest">
              Multi-hop relay network with channel bonding. Built for privacy that never compromises on speed.
            </p>
          </div>

          {/* Link Sections */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[10px] font-black font-mono text-white uppercase tracking-widest mb-6">
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-text-dim hover:text-white transition-colors tracking-wide font-bold"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Tunnely. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-text-dim uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-none bg-primary animate-pulse" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
