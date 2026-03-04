import type { Metadata } from "next";
import { Accessibility, CheckCircle2, MonitorSmartphone, Keyboard, Eye, MessageSquare } from "lucide-react";
import { CTASection } from "@/components/marketing/CTASection";

export const metadata: Metadata = {
  title: "Accessibility Commitment",
  description:
    "Tunnely's engineering commitment to digital equality, WCAG 2.1 AA standards, and universal access. Learn about our accessible VPN design.",
  keywords: ["VPN accessibility", "WCAG 2.1", "accessible VPN", "keyboard navigation", "screen reader VPN", "digital equality"],
  openGraph: {
    title: "Accessibility | Tunnely",
    description:
      "Our commitment to WCAG 2.1 AA compliance, keyboard operability, and assistive technology support.",
    url: "/accessibility",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Accessibility | Tunnely",
    description: "WCAG 2.1 AA compliance, keyboard operability, and assistive technology support.",
  },
};

const standards = [
  {
    id: "01",
    icon: CheckCircle2,
    title: "WCAG 2.1 Level AA",
    description:
      "We strictly target Web Content Accessibility Guidelines (WCAG) 2.1 Level AA conformity across our entire digital infrastructure, treating accessibility regressions as critical deployment blockers.",
  },
  {
    id: "02",
    icon: Keyboard,
    title: "Keyboard Operability",
    description:
      "Every interactive element, configuration panel, and relay selection tool is fully operable via keyboard interfaces without trapping focus or requiring specific timing constraints.",
  },
  {
    id: "03",
    icon: Eye,
    title: "Visual Adaptation",
    description:
      "Our stark, high-contrast brutalist UI directly supports optimal legibility. We enforce strict contrast ratios, support system-level scaling, and ensure content remains readable without relying solely on color.",
  },
  {
    id: "04",
    icon: MonitorSmartphone,
    title: "Assistive Technology",
    description:
      "We semantically structure our DOM layers with ARIA landmarks and descriptive attributes, verifying compatibility with industry-standard screen readers across both desktop and mobile environments.",
  },
];

export default function AccessibilityPage() {
  return (
    <>
      <main className="pt-16 bg-[#121212] min-h-screen">
        {/* Header Module */}
        <section className="py-24 relative border-b border-white/[0.08]">
          <div className="relative max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/10 text-primary uppercase tracking-widest font-mono text-[10px] font-bold mb-6">
                <Accessibility className="w-3.5 h-3.5" strokeWidth={2} />
                Accessibility Protocol
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight uppercase tracking-tight">
                Digital<br />
                <span className="text-primary">Equality</span>
              </h1>
            </div>
            <div className="border-l border-white/[0.08] pl-8">
              <p className="text-base text-text-dim leading-relaxed font-mono">
                Privacy implies universal protection. If software is not accessible to everyone regardless of physical or cognitive ability, it fails its foundational mandate. We engineer Tunnely to remove barriers, not create them.
              </p>
            </div>
          </div>
        </section>

        {/* Commitment Statement */}
        <section className="py-24 border-b border-white/[0.08] bg-bg relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-6 relative z-10">
            <h2 className="text-xl font-mono text-primary font-bold uppercase tracking-widest mb-12 flex items-center gap-4">
              <span className="w-8 h-[1px] bg-primary"></span>
              Our Commitment
            </h2>
            <div className="space-y-8 font-mono text-text-dim leading-relaxed text-sm">
              <p className="p-6 border border-white/[0.08] bg-[#121212]">
                At Tunnely, digital accessibility is treated not as a secondary checklist, but as a primary engineering constraint. We unequivocally believe that the fundamental right to privacy and secure communication must never be gated behind poor design choices or inaccessible interfaces.
              </p>
              <div className="flex flex-col gap-8 pl-12 border-l border-primary/30 py-4">
                <p>
                  We are continuously committing resources to ensure that our public web interfaces, secure dashboards, and native cross-platform binaries are robustly usable by individuals utilizing assistive technologies. This includes comprehensive support for screen readers, specialized keyboard navigation, and high-visibility contrast environments.
                </p>
                <p>
                  As we deploy new cryptographic features and infrastructure updates, our CI/CD pipelines and manual QA processes are geared toward identifying and remediating accessibility barriers before they reach production.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Powered by A11ycore */}
        <section className="py-24 border-b border-white/[0.08] bg-[#121212]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center gap-12 bg-white/[0.02] border border-white/[0.08] p-10">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
                  Powered by <span className="text-primary">A11ycore</span>
                </h3>
                <p className="text-sm font-mono text-text-dim leading-relaxed mb-6">
                  Maintaining structural accessibility across a rapidly evolving application requires specialized infrastructure. We have integrated <a href="https://www.a11ycore.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline hover:text-white transition-colors">A11ycore's</a> remediation layer into our stack. A11ycore provides continuous DOM auditing, automated structural fixes, and semantic integrity checks, ensuring that our commitment to an inclusive interface scales alongside our global relay network.
                </p>
                <a href="https://www.a11ycore.org" target="_blank" rel="noopener noreferrer" className="inline-block border border-primary/30 bg-primary/10 px-6 py-3 text-xs font-mono font-bold text-primary uppercase tracking-widest hover:bg-primary/20 transition-colors">
                  Learn About A11ycore Architecture
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Standards */}
        <section className="py-24 border-b border-white/[0.08] bg-bg">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-16">
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                Implementation Standards
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-[1px] bg-white/[0.08] border border-white/[0.08]">
              {standards.map((standard) => (
                <div key={standard.title} className="bg-[#121212] p-10 hover:bg-white/[0.02] transition-colors flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/[0.08]">
                    <div className="p-3 border border-white/[0.08] bg-white/[0.02]">
                      <standard.icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                    </div>
                    <span className="font-mono text-xs font-bold text-white/[0.2] tracking-widest">{standard.id}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">
                    {standard.title}
                  </h3>
                  <p className="text-sm font-mono text-text-dim leading-relaxed flex-1">
                    {standard.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feedback Channel */}
        <section className="py-24 bg-[#121212]">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="w-16 h-16 mx-auto bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-8">
              <MessageSquare className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-6">
              Feedback Loop
            </h2>
            <p className="text-base font-mono text-text-dim leading-relaxed mb-8">
              Accessibility is an iterative, operational process. If you encounter any barriers, navigational dead-ends, or contrast issues within the Tunnely ecosystem, we require that data to patch our systems.
            </p>
            <div className="inline-flex flex-col md:flex-row gap-4 items-center justify-center p-6 border border-white/[0.08] bg-white/[0.02]">
              <span className="text-sm font-mono text-text-dim uppercase tracking-widest">Transmit reports to:</span>
              <a href="mailto:accessibility@tunnely.com" className="text-base font-bold text-primary hover:text-white transition-colors">
                accessibility@tunnely.com
              </a>
            </div>
          </div>
        </section>

        <CTASection />
      </main>
    </>
  );
}
