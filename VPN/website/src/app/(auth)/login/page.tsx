import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Tunnely account to manage your multi-hop VPN connections.",
  openGraph: {
    title: "Sign In | Tunnely",
    description: "Access your Tunnely dashboard to manage your multi-hop VPN connections.",
    url: "/login",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: "Sign In | Tunnely",
    description: "Access your Tunnely multi-hop VPN dashboard.",
  },
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
