import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import { generateOrganizationLD, generateSoftwareApplicationLD } from "@/lib/utils/structured-data";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tunnely.org"),
  alternates: {
    canonical: "./",
  },
  title: {
    default: "Tunnely  - Multi-Hop Privacy Network",
    template: "%s | Tunnely",
  },
  description:
    "Secure your internet with multi-hop relay routing, channel bonding, and WireGuard encryption. Fast, private, and built for the modern web.",
  keywords: [
    "VPN",
    "multi-hop VPN",
    "tunnely",
    "WireGuard",
    "channel bonding",
    "privacy",
    "encryption",
    "secure browsing",
  ],
  authors: [{ name: "Tunnely" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Tunnely",
    title: "Tunnely  - Multi-Hop Privacy Network",
    description:
      "Secure your internet with multi-hop relay routing, channel bonding, and WireGuard encryption.",
    url: "/",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tunnely  - Multi-Hop Privacy Network",
    description:
      "Secure your internet with multi-hop relay routing, channel bonding, and WireGuard encryption.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateOrganizationLD()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateSoftwareApplicationLD()),
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
