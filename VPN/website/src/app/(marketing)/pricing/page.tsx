import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PricingCards } from "@/components/marketing/PricingCards";
import { CTASection } from "@/components/marketing/CTASection";
import { Check, X } from "lucide-react";
import { generateFAQPageLD } from "@/lib/utils/structured-data";

export const metadata: Metadata = {
  title: "VPN Pricing & Plans",
  description:
    "Pricing plans for encrypted multi-hop VPN infrastructure. No hidden fees, no data harvesting, and no marketing fluff. Compare Free, Pro, and Enterprise.",
  keywords: ["VPN pricing", "multi-hop VPN plans", "tunnely pricing", "free VPN", "pro VPN", "enterprise VPN", "channel bonding plans"],
  openGraph: {
    title: "VPN Pricing & Plans | Tunnely",
    description:
      "Free, Pro, and Enterprise plans. Multi-hop VPN infrastructure with channel bonding and zero-logging.",
    url: "/pricing",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VPN Pricing & Plans | Tunnely",
    description: "Free, Pro, and Enterprise plans for multi-hop VPN with channel bonding.",
  },
};

const comparisonFeatures = [
  { name: "Bandwidth", free: "5 GB/mo", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "Devices", free: "1", pro: "5", enterprise: "10" },
  { name: "Server Locations", free: "Standard", pro: "All", enterprise: "All" },
  { name: "Max Hops", free: "2", pro: "5", enterprise: "Unlimited" },
  { name: "Channel Bonding", free: false, pro: true, enterprise: true },
  { name: "QUIC Obfuscation", free: false, pro: true, enterprise: true },
  { name: "Priority Support", free: false, pro: false, enterprise: true },
  { name: "Dedicated Exit IPs", free: false, pro: false, enterprise: true },
];

const faqs = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes. Upgrade or downgrade anytime via the API or your dashboard. Changes map directly and immediately to your active configuration.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "The Free tier acts as an indefinite entry point for standard browsing. For professional telemetry, a paid license is required up front.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We process fiat via Stripe (Cards, Link) and will soon natively support non-custodial crypto payments.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Cancellation is instant and retains service exactly until the billing epoch concludes. No dark patterns, no retention calls.",
  },
  {
    q: "Do you offer refunds?",
    a: "Our strict zero-logs policy means all usage is cryptographically secure. As such, to prevent abuse, we honor refunds purely for technical failures up to 14 days.",
  },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  const mappedPlans = plans?.map((plan) => ({
    ...plan,
    features: (plan.features || []).map((f: string) => ({
      name: f,
      included: true,
    })),
  }));

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 relative bg-[#121212]">
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-6 uppercase tracking-tight text-white gap-2 flex flex-col items-center">
            <span>Simple, Transparent</span>
            <span className="text-primary border-b-4 border-primary pb-2 inline-block">Pricing</span>
          </h1>
          <p className="text-sm font-mono text-text-dim max-w-2xl mx-auto tracking-widest uppercase mt-8 leading-relaxed">
            Encrypted multi-hop infrastructure for privacy professionals. No hidden fees, no data harvesting, and no marketing fluff.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <div className="border-b border-white/[0.08] bg-[#121212] pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <PricingCards plans={mappedPlans || undefined} hideHeader={true} />
        </div>
      </div>

      {/* Comparison Table */}
      <section className="py-24 bg-bg border-b border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
              Feature Comparison
            </h2>
            <p className="text-text-dim text-lg max-w-2xl mx-auto">
              Detailed technical specifications across all infrastructure tiers.
            </p>
          </div>
          
          <div className="border border-white/[0.08] bg-[#161616] overflow-hidden rounded-3xl">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="text-left px-6 py-5 text-xs font-bold text-text-dim uppercase tracking-wider">
                    Specification
                  </th>
                  <th className="text-center px-4 py-5 text-xs font-bold text-text-dim uppercase tracking-wider">
                    Free
                  </th>
                  <th className="text-center px-4 py-5 text-xs font-bold text-primary uppercase tracking-wider">
                    Pro
                  </th>
                  <th className="text-center px-4 py-5 text-xs font-bold text-white uppercase tracking-wider">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, i) => (
                  <tr key={feature.name} className="border-b border-white/[0.08] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-5 text-sm font-semibold text-white">
                      {feature.name}
                    </td>
                    {(["free", "pro", "enterprise"] as const).map((tier) => {
                      const val = feature[tier];
                      return (
                        <td key={tier} className="text-center px-4 py-5">
                          {typeof val === "boolean" ? (
                            val ? (
                              <Check className="w-5 h-5 text-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-white/[0.1] mx-auto" />
                            )
                          ) : (
                            <span className="text-sm font-medium text-text-dim">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-[#121212] border-b border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
              Technical FAQ
            </h2>
            <p className="text-text-dim text-lg">
              Answers regarding our routing infrastructure, data retention, and billing policies.
            </p>
          </div>
          
          <div className="flex flex-col gap-4">
            {faqs.map((faq, i) => (
              <div key={faq.q} className="bg-[#161616] p-8 rounded-2xl border border-white/[0.05] hover:border-white/[0.1] transition-colors">
                <h3 className="text-lg font-bold text-white mb-3 tracking-tight flex items-center gap-3">
                  <span className="text-primary text-xs font-bold bg-primary/10 px-3 py-1 rounded-full uppercase">
                    Q{(i + 1).toString().padStart(2, '0')}
                  </span>
                  {faq.q}
                </h3>
                <p className="text-sm text-text-dim leading-relaxed pl-14">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />

      {/* JSON-LD FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateFAQPageLD(
              faqs.map((f) => ({ question: f.q, answer: f.a }))
            )
          ),
        }}
      />
    </>
  );
}
