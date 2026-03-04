"use client";

import { useState } from "react";
import { PrefetchLink as Link } from "@/components/ui/PrefetchLink";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleAppleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="bg-[#121212] border border-white/[0.08] p-10">
      {/* Brand */}
      <div className="flex items-center justify-center mb-8 group relative w-max mx-auto">
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-none" />
        <span className="text-[17px] font-black text-white tracking-tight uppercase">
          Tunnely
        </span>
      </div>

      {/* Heading */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
          {mode === "signup" ? "Sign Up" : "Sign In"}
        </h1>
        <p className="text-[10px] font-mono font-bold text-text-dim uppercase tracking-widest">
          {mode === "signup"
            ? "Create an account"
            : "Access your account"}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email */}
        <div>
          <label htmlFor="auth-email" className="block text-[10px] font-mono font-bold text-text-dim uppercase tracking-widest mb-2">
            Email address
          </label>
          <div className="relative">
            <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim/40 pointer-events-none" />
            <input
              id="auth-email"
              type="email"
              placeholder="operator@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 bg-white/[0.02] border border-white/[0.08] rounded-none text-white text-sm font-mono placeholder:text-text-dim/30 outline-none focus:border-primary/50 focus:bg-white/[0.04] transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="auth-password" className="text-[10px] font-mono font-bold text-text-dim uppercase tracking-widest">
              Password
            </label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-[10px] font-mono font-bold text-primary hover:text-white transition-colors uppercase tracking-widest"
              >
                Forgot Password?
              </Link>
            )}
          </div>
          <div className="relative">
            <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim/40 pointer-events-none" />
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-11 pr-11 py-3 bg-white/[0.02] border border-white/[0.08] rounded-none text-white text-sm font-mono placeholder:text-text-dim/30 outline-none focus:border-primary/50 focus:bg-white/[0.04] transition-all tracking-widest"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim/40 hover:text-white p-1 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="w-4 h-4" />
              ) : (
                <Eye aria-hidden="true" className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs font-mono font-bold uppercase tracking-widest text-[#EF4444] px-4 py-3 border border-[#EF4444]/30 bg-[#EF4444]/10 text-center">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white font-mono text-sm font-bold uppercase tracking-widest transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Processing..."
            : mode === "signup"
              ? "Sign Up"
              : "Sign In"}
          {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-8">
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
          Alternate Protocol
        </span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>

      {/* OAuth Buttons */}
      <div className="flex flex-col gap-3">
        {/* Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.08] text-xs font-mono font-bold text-text-dim uppercase tracking-widest hover:text-white hover:bg-white/[0.04] hover:border-white/[0.15] transition-all cursor-pointer"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google Auth
        </button>

        {/* Apple OAuth */}
        <button
          onClick={handleAppleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.08] text-xs font-mono font-bold text-text-dim uppercase tracking-widest hover:text-white hover:bg-white/[0.04] hover:border-white/[0.15] transition-all cursor-pointer"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.28-3.74 4.25z"
            />
          </svg>
          Apple Auth
        </button>
      </div>

      {/* Toggle */}
      <p className="text-center text-[10px] font-mono text-text-dim uppercase tracking-widest mt-8">
        {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={mode === "signup" ? "/login" : "/signup"}
          className="text-primary font-bold hover:text-white transition-colors"
        >
          {mode === "signup" ? "Sign In" : "Sign Up"}
        </Link>
      </p>
    </div>
  );
}
