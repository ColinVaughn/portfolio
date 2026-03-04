import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { User, Mail, Shield } from "lucide-react";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = {
  title: "Account Settings",
  openGraph: {
    title: "Account Settings | Tunnely Dashboard",
    description: "Manage your Tunnely account settings.",
    url: "/dashboard/settings",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <h1 className="text-2xl font-black mb-2">Account Settings</h1>
      <p className="text-text-dim mb-8">Manage your account details.</p>

      {/* Account Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Account Information</CardTitle>
            <User className="w-4 h-4 text-text-dim" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-text-dim" />
              <div>
                <p className="text-xs text-text-dim uppercase tracking-wider">
                  Email
                </p>
                <p className="text-sm text-text">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-text-dim" />
              <div>
                <p className="text-xs text-text-dim uppercase tracking-wider">
                  User ID
                </p>
                <p className="text-sm text-text font-mono">{user?.id}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-danger">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-dim mb-4">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          <button className="px-4 py-2 text-sm font-medium rounded-lg border border-danger/20 text-danger bg-danger/5 hover:bg-danger/10 transition-colors cursor-pointer">
            Delete Account
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
