"use client";

import { PrefetchLink as Link } from "@/components/ui/PrefetchLink";
import { useState, useEffect } from "react";
import { Menu, X, ArrowRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { href: "/infrastructure", label: "Infrastructure" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/download", label: "Download" },
  { href: "/about", label: "About" },
  { href: "/docs", label: "Docs" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.08] bg-[#121212]">
      <div className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-2 h-2 bg-primary rounded-none" />
          <span className="text-[17px] font-black text-white tracking-tight uppercase">
            Tunnely
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-bold text-text-dim hover:text-white transition-colors tracking-wide"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          {session ? (
            <>
              <button
                onClick={handleSignOut}
                className="text-sm font-bold text-text-dim hover:text-white transition-colors tracking-wide flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
              <Link href="/dashboard">
                <button className="px-5 py-2 bg-primary text-white text-sm font-bold tracking-wide transition-colors hover:bg-primary/90 flex items-center gap-2">
                  Dashboard
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={3} />
                </button>
              </Link>
            </>
          ) : (
            <Link href="/login">
              <button className="px-5 py-2 bg-primary text-white text-sm font-bold tracking-wide transition-colors hover:bg-primary/90 flex items-center gap-2">
                Sign In
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={3} />
              </button>
            </Link>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden p-2 text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden absolute top-16 left-0 right-0 border-b border-white/[0.08] bg-[#121212] transition-all duration-300 overflow-hidden",
          mobileOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-6 py-6 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-base font-bold text-text-dim hover:text-white transition-colors tracking-wide"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/[0.08]">
            {session ? (
              <>
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileOpen(false);
                  }}
                  className="py-2 text-base font-bold text-text-dim text-center border border-white/[0.15] flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  <button className="w-full py-3 bg-primary text-white text-base font-bold tracking-wide transition-colors flex items-center justify-center gap-2">
                    Dashboard
                    <ArrowRight className="w-4 h-4" strokeWidth={3} />
                  </button>
                </Link>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <button className="w-full py-3 bg-primary text-white text-base font-bold tracking-wide transition-colors flex items-center justify-center gap-2">
                  Sign In
                  <ArrowRight className="w-4 h-4" strokeWidth={3} />
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
