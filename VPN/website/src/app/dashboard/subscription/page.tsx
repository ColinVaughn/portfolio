import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Check, CreditCard, Calendar, AlertCircle } from "lucide-react";
import { ManageSubscriptionButton } from "./ManageButton";

export const metadata: Metadata = {
  title: "Subscription",
  openGraph: {
    title: "Subscription | Tunnely Dashboard",
    description: "Manage your Tunnely subscription.",
    url: "/dashboard/subscription",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
};

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("user_id", user!.id)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();

  const plan = subscription?.plans;

  return (
    <div>
      <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Subscription</h1>
      <p className="text-sm font-mono text-text-dim mb-10 tracking-widest uppercase">
        Manage your plan and billing.
      </p>

      {/* Current Plan */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Plan</CardTitle>
            <CreditCard className="w-4 h-4 text-text-dim" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl font-black text-white tracking-tight uppercase">
              {plan?.name || "Free"}
            </span>
            {subscription && (
              <Badge
                variant={
                  subscription.status === "active"
                    ? "success"
                    : subscription.status === "past_due"
                      ? "warning"
                      : "default"
                }
              >
                {subscription.status}
              </Badge>
            )}
          </div>

          {plan?.description && (
            <p className="text-sm font-mono text-text-dim mb-6">{plan.description}</p>
          )}

          {/* Plan Features */}
          {plan?.features && (
            <ul className="space-y-3 mb-8 border-t border-white/[0.08] pt-6">
              {(plan.features as string[]).map((feature: string) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm font-mono text-text-dim"
                >
                  <Check className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={2.5} />
                  {feature}
                </li>
              ))}
            </ul>
          )}

          {/* Billing Info */}
          {subscription && (
            <div className="bg-white/[0.02] border border-white/[0.08] p-6 space-y-4 mb-8">
              <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-widest">
                <span className="text-text-dim flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Billing interval
                </span>
                <span className="text-white capitalize">
                  {subscription.billing_interval}
                </span>
              </div>
              {subscription.current_period_end && (
                <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-widest pt-4 border-t border-white/[0.08]">
                  <span className="text-text-dim">Next auto-renewal</span>
                  <span className="text-white">
                    {new Date(
                      subscription.current_period_end
                    ).toLocaleDateString()}
                  </span>
                </div>
              )}
              {subscription.cancel_at_period_end && (
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#F59E0B] mt-4 pt-4 border-t border-white/[0.08]">
                  <AlertCircle className="w-4 h-4" />
                  Cancels at end of billing period
                </div>
              )}
            </div>
          )}

          {/* Manage Button */}
          {subscription?.stripe_customer_id ? (
            <ManageSubscriptionButton />
          ) : (
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 py-4 px-6 bg-primary text-white font-mono text-sm font-bold uppercase tracking-widest transition-colors hover:bg-primary/90"
            >
              Upgrade Protocol
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
