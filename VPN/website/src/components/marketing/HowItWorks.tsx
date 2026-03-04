"use client";

import { motion } from "framer-motion";
import { Laptop, ServerCrash, Network, Globe } from "lucide-react";

const steps = [
  {
    icon: Laptop,
    step: "01",
    title: "Local Connection",
    subtitle: "AES-256-GCM Encryption",
    description: "Client tunnel established via the Tunnely application.",
  },
  {
    icon: ServerCrash,
    step: "02",
    title: "Guard Node (Hop 1)",
    subtitle: "Entry Node: Netherlands",
    description: "Initial IP mask at entry infrastructure.",
  },
  {
    icon: Network,
    step: "03",
    title: "Relayer (Hop 2)",
    subtitle: "Relay Node: Switzerland",
    description: "Cross-jurisdictional re-encryption pass.",
  },
  {
    icon: Globe,
    step: "04",
    title: "Secure Exit",
    subtitle: "Exit Node: Iceland",
    description: "Traffic egress to the public web.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-bg relative border-b border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-20">
          <h2 className="text-3xl md:text-4xl font-black text-text mb-4 tracking-tight">
            The Multi-Hop Workflow
          </h2>
          <p className="text-text-dim text-base max-w-xl font-mono">
            A technical breakdown of our secure data transit path.
          </p>
        </div>

        <div className="flex flex-col md:flex-row relative">
          {/* Strict primary blue connection line */}
          <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-[2px] bg-primary" />

          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="relative flex-1 px-4 mb-12 md:mb-0"
            >
              {/* Node Point */}
              <div className="relative mx-auto w-14 h-14 bg-bg border-2 border-primary rounded-full flex items-center justify-center mb-6 z-10">
                <step.icon className="w-6 h-6 text-primary" strokeWidth={2} />
              </div>
              
               <div className="hidden md:block absolute top-[28px] left-1/2 w-4 h-[2px] bg-bg -ml-2 z-20" /> {/* Cutout for line intersection */}

              <div className="text-center md:text-left">
                <div className="font-mono text-xs text-primary mb-2 font-bold tracking-widest uppercase">
                  Step {step.step}
                </div>
                <h3 className="text-lg font-bold text-text mb-1 tracking-tight">
                  {step.title}
                </h3>
                <div className="text-xs font-mono text-text-dim/80 mb-3 pb-3 border-b border-white/[0.08] inline-block">
                  {step.subtitle}
                </div>
                <p className="text-sm text-text-dim leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
