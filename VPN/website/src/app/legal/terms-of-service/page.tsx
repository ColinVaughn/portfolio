import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Tunnely Terms of Service  - the rules governing use of our encrypted multi-hop VPN service, subscription billing, and acceptable use.",
  keywords: ["VPN terms of service", "tunnely TOS", "VPN acceptable use", "VPN subscription terms"],
  openGraph: {
    title: "Terms of Service | Tunnely",
    description: "The rules governing use of our encrypted multi-hop VPN service.",
    url: "/legal/terms-of-service",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: "Terms of Service | Tunnely",
    description: "The rules governing use of our encrypted multi-hop VPN service.",
  },
};

export default function TermsOfServicePage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-6 py-24">
          <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
          <p className="text-sm text-text-dim mb-12">Last updated: February 2026</p>

          <div className="prose-custom space-y-8">
            <section>
              <h2>1. Acceptance of Terms</h2>
              <p>
                By using Tunnely (&quot;the Service&quot;), you agree to these Terms of
                Service. If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2>2. Service Description</h2>
              <p>
                Tunnely provides encrypted multi-hop VPN services through a
                distributed relay network. We offer free and paid subscription
                tiers with varying features and bandwidth limits.
              </p>
            </section>

            <section>
              <h2>3. Account Registration</h2>
              <p>
                You must provide a valid email address to create an account. You
                are responsible for maintaining the security of your account
                credentials and for all activity under your account.
              </p>
            </section>

            <section>
              <h2>4. Acceptable Use</h2>
              <p>You agree NOT to use the Service for:</p>
              <ul>
                <li>Any illegal activity under applicable law</li>
                <li>Distribution of malware or unauthorized access to systems</li>
                <li>Spamming, phishing, or social engineering attacks</li>
                <li>Interfering with the operation of the Service</li>
                <li>Circumventing bandwidth or device limits</li>
              </ul>
            </section>

            <section>
              <h2>5. Subscription &amp; Billing</h2>
              <p>
                Paid plans are billed monthly or yearly through Stripe.
                Subscriptions auto-renew unless canceled before the renewal
                date. Refunds are handled on a case-by-case basis within 30
                days of purchase.
              </p>
            </section>

            <section>
              <h2>6. Service Availability</h2>
              <p>
                We strive for 99.9% uptime but do not guarantee uninterrupted
                service. We may perform maintenance with reasonable notice.
                Server locations and availability may change.
              </p>
            </section>

            <section>
              <h2>7. Limitation of Liability</h2>
              <p>
                The Service is provided &quot;as is&quot; without warranties of any kind.
                We are not liable for any damages arising from the use or
                inability to use the Service, including but not limited to data
                loss, service interruptions, or security breaches.
              </p>
            </section>

            <section>
              <h2>8. Termination</h2>
              <p>
                We may suspend or terminate your account if you violate these
                Terms. You may delete your account at any time through the
                dashboard settings.
              </p>
            </section>

            <section>
              <h2>9. Changes to Terms</h2>
              <p>
                We may update these Terms. Significant changes will be
                communicated via email. Continued use after changes constitutes
                acceptance.
              </p>
            </section>

            <section>
              <h2>10. Contact</h2>
              <p>
                For questions about these Terms, contact us at{" "}
                <a href="mailto:legal@tunnely.com">legal@tunnely.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
