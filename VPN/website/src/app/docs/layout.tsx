import type { Metadata } from "next";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { MobileDocNav } from "@/components/docs/MobileDocNav";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    template: "%s | Tunnely Docs",
    default: "Tunnely Documentation",
  },
  description: "Official documentation for the Tunnely zero-knowledge VPN network and desktop client.",
  openGraph: {
    title: "Tunnely Documentation",
    description: "Official documentation for the Tunnely zero-knowledge VPN network and desktop client.",
    url: "/docs",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#121212] flex flex-col pt-16">
      <div className="flex-1 flex flex-col md:flex-row max-w-[1600px] w-full mx-auto relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-72 shrink-0 border-r border-white/[0.08] bg-[#0A0A0A]">
          <div className="sticky top-16 h-[calc(100vh-4rem)]">
            <DocsSidebar />
          </div>
        </div>

        {/* Mobile Navigation */}
        <MobileDocNav />

        {/* Main Documentation Content Area */}
        <main className="flex-1 min-w-0 bg-[#121212]">
          <div className="max-w-4xl mx-auto p-6 md:p-12 lg:p-16">
            {children}
          </div>
        </main>
      </div>
      </div>
      <Footer />
    </>
  );
}
