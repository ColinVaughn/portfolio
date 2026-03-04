import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your Tunnely account password to regain access to your multi-hop VPN dashboard.",
  openGraph: {
    title: "Reset Password | Tunnely",
    description: "Recover access to your Tunnely account.",
    url: "/forgot-password",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
