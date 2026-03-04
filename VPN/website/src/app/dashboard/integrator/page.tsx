import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Wrench, Key, Package, Info, Download, ShieldCheck, DollarSign, Terminal } from "lucide-react";
import { KeyManager } from "@/components/dashboard/KeyManager";

export const metadata: Metadata = {
  title: "Integrator Panel",
  openGraph: {
    title: "Integrator Panel | Tunnely",
    description: "Tunnely Integrator dashboard.",
    url: "/dashboard/integrator",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
};

export default async function IntegratorPage() {
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

  if (!roleData || (roleData.role !== "integrator" && roleData.role !== "admin")) {
    redirect("/dashboard");
  }

  const adminDb = createAdminClient();

  // Fetch Integrator's Trials
  const { data: trials } = await adminDb
    .from("integrator_trials")
    .select("status")
    .eq("integrator_id", user.id);

  const activeTrials = trials?.filter(t => t.status === "active").length || 0;

  // Fetch Integrator's Converted Subscriptions
  const { data: subscriptions } = await adminDb
    .from("subscriptions")
    .select("status, billing_interval, plan:plans(price_monthly, price_yearly)")
    .eq("integrator_id", user.id)
    .in("status", ["active", "trialing"]);

  let mrr = 0;
  let arr = 0;
  const activeSubs = subscriptions?.length || 0;

  if (subscriptions) {
    for (const sub of subscriptions) {
      // @ts-ignore
      const planObj = sub.plan;
      if (!planObj) continue;
      
      const plan = Array.isArray(planObj) ? planObj[0] : planObj;

      let subArr = 0;
      if (sub.billing_interval === "yearly") {
        subArr = plan?.price_yearly || 0;
      } else {
        subArr = (plan?.price_monthly || 0) * 12;
      }

      // Integrator earns 50% commission
      const commissionArr = subArr * 0.5;
      arr += commissionArr;
      mrr += commissionArr / 12;
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black mb-2 flex items-center gap-3">
          <Wrench className="w-6 h-6 text-primary" />
          System Integrator Panel
        </h1>
        <p className="text-text-dim">
          Generate API licenses for bundled OS images and third-party hardware distribution.
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-5 mb-8">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex flex-col justify-center">
            <p className="text-sm font-medium text-primary mb-1">Your MRR (50%)</p>
            <p className="text-3xl font-black text-white">${mrr.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-6 flex flex-col justify-center">
            <p className="text-sm font-medium text-success mb-1">Your ARR (50%)</p>
            <p className="text-3xl font-black text-white">${arr.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <p className="text-sm font-medium text-text-dim mb-1">Pending Trials</p>
            <p className="text-3xl font-black text-white">{activeTrials}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <p className="text-sm font-medium text-text-dim mb-1">Converted Subs</p>
            <p className="text-3xl font-black text-white">{activeSubs}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-accent" />
              <CardTitle>Activation Keys</CardTitle>
            </div>
            <CardDescription>Batch generate commercial activation keys</CardDescription>
          </CardHeader>
          <CardContent>
            <KeyManager />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-success" />
              <CardTitle>White-Label Build Tool</CardTitle>
            </div>
            <CardDescription>Compile pre-configured native installers</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-sm text-text-dim italic">
              Pre-compiled package downloads will be accessible here.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-primary" />
            <CardTitle>Deployment Guide & Revenue Share</CardTitle>
          </div>
          <CardDescription>How to pre-install Tunnely and earn recurring commissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6 pt-4">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/[0.08]">
                <Download className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-white text-lg">1. Install Client</h3>
              <p className="text-sm text-text-dim leading-relaxed">
                Download the latest Tunnely Native Client from the <a href="/download" className="text-primary hover:underline">downloads page</a> and install it on the target hardware before shipping to your customer.
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/[0.08]">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-bold text-white text-lg">2. Activate Trial</h3>
              <p className="text-sm text-text-dim leading-relaxed">
                Generate a unique 30-Day Commercial Trial Key from the panel above. Open the Tunnely app on the target device, click "Activate Integrator Trial", and enter the key. The device is now silently bonded to your Integrator ID.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/[0.08]">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <h3 className="font-bold text-white text-lg">3. Earn Revenue</h3>
              <p className="text-sm text-text-dim leading-relaxed">
                When the customer&apos;s 30-day hardware trial expires, they will be prompted to purchase a standard subscription. If they convert, your Integrator ID automatically locks in a <b>50% revenue share</b> for the first year of their subscription.
              </p>
            </div>
          </div>
          
          <div className="mt-8 border-t border-white/10 pt-6">
            <h3 className="font-bold text-white text-lg flex items-center gap-2 mb-4">
              <Terminal className="w-5 h-5 text-text-dim" />
              Automate with Native CLI
            </h3>
            <p className="text-sm text-text-dim mb-4">
              The Tunnely client includes a built-in headless CLI specifically designed for automated SI deployments and sysprep imaging. You can mint keys and attach devices without ever opening the GUI:
            </p>
            <div className="bg-[#111] border border-white/5 rounded-lg p-4 font-mono text-sm text-success overflow-x-auto whitespace-pre">
              # 1. Generate a new key remotely using your Integrator credentials{"\n"}
              &gt; tunnely-client --generate-key -u <span className="text-white">"{user.email}"</span> -p <span className="text-white">"your_password"</span>{"\n"}
              {"\n"}
              # 2. Silently bind the hardware natively on boot{"\n"}
              &gt; tunnely-client --activate-trial <span className="text-accent">"TRIAL-A1B2C3D4..."</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
