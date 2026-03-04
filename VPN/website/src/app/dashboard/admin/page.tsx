import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { ShieldAlert, Users, Server, Activity } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Panel",
  openGraph: {
    title: "Admin Panel | Tunnely",
    description: "Tunnely Administration.",
    url: "/dashboard/admin",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Authorize User
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!roleData || roleData.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black mb-2 flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-[#EF4444]" />
          Admin Control Plane
        </h1>
        <p className="text-text-dim">
          Global infrastructure management and user administration.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-accent" />
              <CardTitle>Global Users</CardTitle>
            </div>
            <CardDescription>Manage subscriber accounts and roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-text-dim italic">
              User table management controls will be mounted here.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-success" />
              <CardTitle>Fleet Management</CardTitle>
            </div>
            <CardDescription>Monitor and provision exit nodes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-text-dim italic">
              Relay server fleet configurations will be mounted here.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle>Network Telemetry</CardTitle>
            </div>
            <CardDescription>Realtime latency and load analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-text-dim italic">
              Internal system load charts will be generated here.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
