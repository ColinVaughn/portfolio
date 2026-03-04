"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { Lock, CheckCircle } from "lucide-react";

export function SettingsForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="settings-new-password" className="block text-xs font-semibold text-text-dim uppercase tracking-wider mb-1.5">
          New Password
        </label>
        <div className="relative">
          <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim/40 pointer-events-none" />
          <input
            id="settings-new-password"
            type="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full pl-11 pr-4 py-3 bg-white/[0.03] border border-white/[0.07] rounded-xl text-text text-sm placeholder:text-text-dim/30 outline-none focus:border-purple/40 focus:ring-2 focus:ring-purple/10 transition-all"
          />
        </div>
      </div>
      <div>
        <label htmlFor="settings-confirm-password" className="block text-xs font-semibold text-text-dim uppercase tracking-wider mb-1.5">
          Confirm Password
        </label>
        <div className="relative">
          <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim/40 pointer-events-none" />
          <input
            id="settings-confirm-password"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full pl-11 pr-4 py-3 bg-white/[0.03] border border-white/[0.07] rounded-xl text-text text-sm placeholder:text-text-dim/30 outline-none focus:border-purple/40 focus:ring-2 focus:ring-purple/10 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-danger px-3 py-2 bg-danger/[0.08] border border-danger/15 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-xs text-success px-3 py-2 bg-success/[0.08] border border-success/15 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          Password updated successfully
        </div>
      )}

      <Button type="submit" disabled={loading} variant="outline" size="md">
        {loading ? "Updating..." : "Update Password"}
      </Button>
    </form>
  );
}
