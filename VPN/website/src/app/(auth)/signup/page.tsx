import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your Tunnely account and start protecting your privacy with multi-hop VPN encryption.",
  openGraph: {
    title: "Sign Up | Tunnely",
    description: "Create your account and start routing traffic through encrypted multi-hop relays.",
    url: "/signup",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: "Sign Up | Tunnely",
    description: "Create your Tunnely account and encrypt your traffic with multi-hop relays.",
  },
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
