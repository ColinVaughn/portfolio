import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Tunnely Privacy Policy  - how we handle your data, what we collect, and what we don't. Zero-logging, zero-tracking, zero-compromise.",
  keywords: ["VPN privacy policy", "tunnely privacy", "zero-logging policy", "data collection VPN", "no-logs VPN"],
  openGraph: {
    title: "Privacy Policy | Tunnely",
    description: "How we handle your data: zero-logging, zero-tracking, zero-compromise.",
    url: "/legal/privacy-policy",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | Tunnely",
    description: "How we handle your data: zero-logging, zero-tracking, zero-compromise.",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-6 py-24">
          <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
          <p className="text-sm text-text-dim mb-12">Last updated: February 2026</p>

          <div className="prose-custom space-y-8">
            <section>
              <h2>1. Overview</h2>
              <p>
                Tunnely (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your
                privacy. This policy explains what data we collect, how we use
                it, and your rights regarding that data.
              </p>
            </section>

            <section>
              <h2>2. What We Don&apos;t Collect</h2>
              <p>We do NOT collect or store:</p>
              <ul>
                <li>Browsing history or traffic logs</li>
                <li>DNS queries</li>
                <li>IP addresses associated with your activity</li>
                <li>Connection timestamps</li>
                <li>Bandwidth usage per session</li>
              </ul>
              <p>
                Our multi-hop relay architecture is designed so that no single
                server can associate your identity with your destination.
              </p>
            </section>

            <section>
              <h2>3. What We Collect</h2>
              <p>We collect the minimum data necessary to operate the service:</p>
              <ul>
                <li>
                  <strong>Account information:</strong> Email address and
                  encrypted password hash for authentication.
                </li>
                <li>
                  <strong>Subscription data:</strong> Payment status and plan
                  type (processed by Stripe; we never see your card details).
                </li>
                <li>
                  <strong>Aggregate metrics:</strong> Server load, total active
                  connections (not per-user), and network health data to
                  maintain service quality.
                </li>
              </ul>
            </section>

            <section>
              <h2>4. Payment Processing</h2>
              <p>
                All payments are processed by Stripe, Inc. We do not store
                credit card numbers, CVVs, or bank account information. Stripe&apos;s
                privacy policy governs the handling of your payment data.
              </p>
            </section>

            <section>
              <h2>5. Data Storage &amp; Security</h2>
              <p>
                Account data is stored in a secured PostgreSQL database with
                row-level security policies. Authentication tokens are stored in
                your operating system&apos;s native keychain (Windows Credential
                Manager, macOS Keychain, or Linux Secret Service).
              </p>
            </section>

            <section>
              <h2>6. Third-Party Services</h2>
              <ul>
                <li>
                  <strong>Supabase:</strong> Authentication and database hosting
                </li>
                <li>
                  <strong>Stripe:</strong> Payment processing
                </li>
                <li>
                  <strong>Vercel:</strong> Website hosting
                </li>
              </ul>
            </section>

            <section>
              <h2>7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul>
                <li>Access your personal data</li>
                <li>Request deletion of your account and data</li>
                <li>Export your data in a portable format</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section>
              <h2>8. Contact</h2>
              <p>
                For privacy-related questions, contact us at{" "}
                <a href="mailto:privacy@tunnely.com">privacy@tunnely.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
