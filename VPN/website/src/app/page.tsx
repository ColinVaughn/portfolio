import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/marketing/Hero";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { ArchitectureSection } from "@/components/marketing/ArchitectureSection";
import { StatsCounter } from "@/components/marketing/StatsCounter";
import { PricingCards } from "@/components/marketing/PricingCards";
import { CTASection } from "@/components/marketing/CTASection";
import { ValueProp } from "@/components/marketing/ValueProp";

export const revalidate = 3600;

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <Hero />
        <StatsCounter />
        <ValueProp />
        <HowItWorks />
        <ArchitectureSection />
        <FeatureGrid />
        <PricingCards />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
