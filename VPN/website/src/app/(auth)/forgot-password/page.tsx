"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard/settings`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#121212] border border-white/[0.08] p-10">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-8 group justify-center">
        <div className="w-2 h-2 bg-primary rounded-none" />
        <span className="text-[17px] font-black text-white tracking-tight uppercase">
          Tunnely
        </span>
      </div>

      {sent ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-6">
            <CheckCircle2 className="w-6 h-6 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Transmission Sent</h1>
          <p className="text-sm font-mono text-text-dim mb-8">
            Reset sequence initiated for <strong className="text-white">{email}</strong>.
            Check your inbox to authenticate.
          </p>
          <Link href="/login" className="block">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4" />
              Return to Login
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Recover Key</h1>
            <p className="text-[10px] font-mono font-bold text-text-dim uppercase tracking-widest">
              Provide email to initiate reset
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="forgot-email" className="block text-[10px] font-mono font-bold text-text-dim uppercase tracking-widest mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim/40 pointer-events-none" />
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="operator@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-white/[0.02] border border-white/[0.08] rounded-none text-white text-sm font-mono placeholder:text-text-dim/30 outline-none focus:border-primary/50 focus:bg-white/[0.04] transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs font-mono font-bold uppercase tracking-widest text-[#EF4444] px-4 py-3 border border-[#EF4444]/30 bg-[#EF4444]/10 text-center">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Transmitting..." : "Send Reset Link"}
            </Button>
          </form>

          <p className="text-center text-[10px] font-mono text-text-dim uppercase tracking-widest mt-8">
            Key remembered?{" "}
            <Link href="/login" className="text-primary font-bold hover:text-white transition-colors">
              Authenticate
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
