import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import {
  CreditCard,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
  openGraph: {
    title: "Dashboard | Tunnely",
    description: "Your Tunnely VPN dashboard.",
    url: "/dashboard",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("user_id", user!.id)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();

  // Fetch recent sessions
  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("*, entry_server:relay_servers!entry_server_id(city, country_code), exit_server:relay_servers!exit_server_id(city, country_code)")
    .eq("user_id", user!.id)
    .order("connected_at", { ascending: false })
    .limit(5);

  // Calculate total usage
  const totalTx = sessions?.reduce((sum, s) => sum + (s.bytes_tx || 0), 0) || 0;
  const totalRx = sessions?.reduce((sum, s) => sum + (s.bytes_rx || 0), 0) || 0;

  const plan = subscription?.plans;

  return (
    <div>
      <h1 className="text-2xl font-black mb-2">Dashboard</h1>
      <p className="text-text-dim mb-8">
        Welcome back, {user?.email}
      </p>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-3 gap-5 mb-8">
        {/* Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Plan</CardTitle>
              <CreditCard className="w-4 h-4 text-text-dim" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-black gradient-text">
                {plan?.name || "Free"}
              </span>
              {subscription && (
                <Badge variant={subscription.status === "active" ? "success" : "warning"}>
                  {subscription.status}
                </Badge>
              )}
            </div>
            {subscription?.current_period_end && (
              <p className="text-xs text-text-dim">
                Renews{" "}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            )}
            <Link
              href="/dashboard/subscription"
              className="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Manage subscription
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Data Uploaded</CardTitle>
              <ArrowUpRight className="w-4 h-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-black text-text">
              {formatBytes(totalTx)}
            </span>
            <p className="text-xs text-text-dim mt-1">
              Across {sessions?.length || 0} recent sessions
            </p>
          </CardContent>
        </Card>

        {/* Download */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Data Downloaded</CardTitle>
              <ArrowDownRight className="w-4 h-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-black text-text">
              {formatBytes(totalRx)}
            </span>
            <p className="text-xs text-text-dim mt-1">
              Across {sessions?.length || 0} recent sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Download Action Banner */}
      <Card className="mb-8 border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col md:flex-row items-center justify-between p-6">
          <div className="flex items-center gap-5 mb-4 md:mb-0">
            <div className="w-12 h-12 bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Download className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight uppercase mb-1">Download Tunnely Client</h3>
              <p className="text-xs text-text-dim font-mono tracking-widest uppercase">Install the native OS desktop application to initialize your WireGuard tunnel.</p>
            </div>
          </div>
          <Link href="/download" className="w-full md:w-auto">
            <Button className="w-full md:w-auto px-6 rounded-sm tracking-widest font-bold uppercase bg-primary text-white hover:bg-primary/90">
              Download App
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Sessions</CardTitle>
            <Activity className="w-4 h-4 text-text-dim" />
          </div>
        </CardHeader>
        <CardContent>
          {sessions && sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Server className="w-4 h-4 text-text-dim" />
                    <div>
                      <p className="text-sm font-medium text-text">
                        {(session.entry_server as { city: string } | null)?.city || "Unknown"}{" "}
                        &rarr;{" "}
                        {(session.exit_server as { city: string } | null)?.city || "Unknown"}
                      </p>
                      <p className="text-xs text-text-dim flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.connected_at
                          ? new Date(session.connected_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        session.status === "active" ? "success" : "default"
                      }
                    >
                      {session.status}
                    </Badge>
                    <p className="text-xs text-text-dim mt-1">
                      {formatBytes(
                        (session.bytes_tx || 0) + (session.bytes_rx || 0)
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-dim py-4 text-center">
              No sessions yet. Connect with the desktop app to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
