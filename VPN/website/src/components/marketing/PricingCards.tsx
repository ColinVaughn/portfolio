"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

interface PlanFeature {
  name: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: PlanFeature[];
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

interface PricingCardsProps {
  plans?: Plan[];
  onSelectPlan?: (priceId: string, interval: string) => void;
  hideHeader?: boolean;
}

const defaultPlans: Plan[] = [
  {
    id: "community",
    name: "Community",
    slug: "community",
    description: "Basic entry point for personal security and standard browsing.",
    price_monthly: 0,
    price_yearly: 0,
    features: [
      { name: "Single-hop connection", included: true },
      { name: "3 Global exit nodes", included: true },
      { name: "AES-256 Encryption", included: true },
      { name: "Multi-hop routing", included: false },
      { name: "Custom API Access", included: false },
    ],
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: null,
  },
  {
    id: "professional",
    name: "Professional",
    slug: "professional",
    description: "Full-stack multi-hop infrastructure for high-security workloads.",
    price_monthly: 9.99,
    price_yearly: 99.99,
    features: [
      { name: "Multi-hop routing (up to 5 hops)", included: true },
      { name: "50+ Global locations", included: true },
      { name: "Priority bandwidth allocation", included: true },
      { name: "Port Forwarding & Fixed IPs", included: true },
      { name: "WireGuard & OpenVPN protocol support", included: true },
    ],
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: null,
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    slug: "infrastructure",
    description: "Dedicated hardware and tailored solutions for organizations.",
    price_monthly: 19.99,
    price_yearly: 199.99,
    features: [
      { name: "Dedicated Exit Nodes (Bare metal)", included: true },
      { name: "SSO / SAML Integration", included: true },
      { name: "Full API access for automation", included: true },
      { name: "Audit logs & compliance reporting", included: true },
      { name: "24/7 Priority engineering support", included: true },
    ],
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: null,
  },
];

export function PricingCards({
  plans = defaultPlans,
  onSelectPlan,
  hideHeader = false,
}: PricingCardsProps) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  return (
    <section className="py-24 bg-[#121212] relative border-b border-border">
      <div className="max-w-7xl mx-auto px-6">
        {!hideHeader && (
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-text-dim max-w-2xl mx-auto text-lg">
              Encrypted multi-hop infrastructure for privacy professionals. No hidden fees, no data harvesting, and no marketing fluff.
            </p>
          </div>
        )}

        {/* Interval Toggle */}
        <div className="flex items-center justify-center mb-16">
          <div className="bg-[#1A1A1A] p-1.5 rounded-full border border-white/[0.05] inline-flex items-center">
            <button
              onClick={() => setInterval("monthly")}
              aria-pressed={interval === "monthly"}
              className={cn(
                "px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-300",
                interval === "monthly"
                  ? "bg-white text-black shadow-sm"
                  : "text-text-dim hover:text-white"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("yearly")}
              aria-pressed={interval === "yearly"}
              className={cn(
                "px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 flex items-center gap-2",
                interval === "yearly"
                  ? "bg-white text-black shadow-sm"
                  : "text-text-dim hover:text-white"
              )}
            >
              Yearly
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold transition-colors", interval === "yearly" ? "bg-black text-white" : "bg-primary/20 text-primary")}>
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, i) => {
            const isPopular = plan.slug === "professional";
            const price = interval === "monthly" ? plan.price_monthly : plan.price_yearly;
            const priceId = interval === "monthly" ? plan.stripe_price_id_monthly : plan.stripe_price_id_yearly;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "relative bg-[#161616] p-8 flex flex-col transition-all duration-300 rounded-3xl",
                  isPopular 
                    ? "border-2 border-primary shadow-[0_0_30px_rgba(59,130,246,0.15)] md:-translate-y-4" 
                    : "border border-white/[0.08] hover:border-white/[0.15]"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full whitespace-nowrap shadow-lg">
                    Most Popular
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-text-dim mb-8 h-10 leading-relaxed">{plan.description}</p>

                <div className="mb-8 pb-8 border-b border-white/[0.08]">
                  <span className="text-5xl font-black text-white tracking-tight">
                    ${price === 0 ? "0" : price.toFixed(2)}
                  </span>
                  {price > 0 && (
                    <span className="text-lg text-text-dim ml-1">
                      /{interval === "monthly" ? "mo" : "yr"}
                    </span>
                  )}
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.name}
                      className={cn(
                        "flex items-start gap-3 text-sm flex-1",
                        feature.included ? "text-text" : "text-text-dim/40"
                      )}
                    >
                      {feature.included ? (
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 flex-shrink-0" />
                      )}
                      <span className="mt-0.5">{feature.name}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={cn(
                    "w-full py-4 text-sm font-bold transition-all duration-300 rounded-xl",
                    isPopular
                      ? "bg-primary text-white hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]"
                      : "bg-white/[0.05] text-white hover:bg-white/[0.1] border border-white/[0.05]"
                  )}
                  onClick={() => {
                    if (priceId && onSelectPlan) {
                      onSelectPlan(priceId, interval);
                    }
                  }}
                >
                  {price === 0 ? "Start Free" : "Deploy Network"}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
