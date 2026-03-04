import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const db = createAdminClient();
  const userId = session.metadata?.supabase_user_id;
  const billingInterval = session.metadata?.billing_interval || "monthly";
  const integratorId = session.metadata?.integrator_id || null;

  if (!userId || !session.subscription || !session.customer) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer.id;

  // Find the plan by matching the Stripe price ID
  const lineItems = session.line_items?.data;
  let planId: string | null = null;

  if (lineItems && lineItems.length > 0) {
    const priceId =
      typeof lineItems[0].price === "string"
        ? lineItems[0].price
        : lineItems[0].price?.id;

    if (priceId) {
      const col =
        billingInterval === "yearly"
          ? "stripe_price_id_yearly"
          : "stripe_price_id_monthly";
      const { data: plan } = await db
        .from("plans")
        .select("id")
        .eq(col, priceId)
        .single();

      planId = plan?.id || null;
    }
  }

  if (!planId) {
    // Fallback: use the Pro plan
    const { data: proPlan } = await db
      .from("plans")
      .select("id")
      .eq("slug", "pro")
      .single();
    planId = proPlan?.id || null;
  }

  if (!planId) return;

  await db.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: "active",
      billing_interval: billingInterval,
      ...(integratorId && { integrator_id: integratorId }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const db = createAdminClient();

  // Extract period dates from the subscription items
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start;
  const periodEnd = item?.current_period_end;

  await db
    .from("subscriptions")
    .update({
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const db = createAdminClient();

  await db
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // In Stripe v20+, subscription is accessed via parent
  const sub = (invoice as unknown as Record<string, unknown>).subscription;
  if (!sub) return;

  const db = createAdminClient();
  const subscriptionId = typeof sub === "string" ? sub : (sub as { id: string }).id;

  await db
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);
}
