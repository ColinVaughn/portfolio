import { createSignal, Show, For, onMount } from "solid-js";
import { subscription, isFreePlan, isPremium, setSubscription } from "../lib/stores";
import { getIapProducts, validateIapPurchase, restoreIapPurchases, getSubscription } from "../lib/tauri";

interface IapProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  billing_period: string;
  offer_token?: string;
}

/**
 * Mobile-only paywall component for in-app purchase subscriptions.
 *
 * Shows a premium upgrade card for Free plan users on mobile devices.
 * On desktop, this component renders nothing  - desktop users upgrade via Stripe.
 *
 * Uses Tailwind `md:hidden` to ensure visibility only on mobile viewports.
 */
export default function MobilePaywall() {
  const [products, setProducts] = createSignal<IapProduct[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [purchasing, setPurchasing] = createSignal<string | null>(null);
  const [restoring, setRestoring] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal(false);
  const [selectedInterval, setSelectedInterval] = createSignal<"monthly" | "yearly">("yearly");

  // Load products on mount (mobile only)
  onMount(async () => {
    // Only load if on Free plan
    if (!isFreePlan()) return;

    try {
      setLoading(true);
      const plans = await getIapProducts();
      // Transform the plan data into display products
      const displayProducts: IapProduct[] = [];
      for (const plan of plans) {
        if (plan.slug === "pro") {
          displayProducts.push({
            id: plan.google_product_id_monthly || plan.apple_product_id_monthly || "pro_monthly",
            title: "Pro Monthly",
            description: "Billed monthly",
            price: `$${plan.price_monthly || "9.99"}/mo`,
            currency: "USD",
            billing_period: "P1M",
          });
          displayProducts.push({
            id: plan.google_product_id_yearly || plan.apple_product_id_yearly || "pro_yearly",
            title: "Pro Yearly",
            description: "Billed yearly  - save 40%",
            price: `$${plan.price_yearly || "71.88"}/yr`,
            currency: "USD",
            billing_period: "P1Y",
          });
        }
      }
      setProducts(displayProducts);
    } catch (err) {
      console.error("Failed to load IAP products:", err);
    } finally {
      setLoading(false);
    }
  });

  const handlePurchase = async (productId: string) => {
    setError(null);
    setPurchasing(productId);
    try {
      // The native plugin handles the purchase flow
      // After purchase, validate with the backend
      const result = await validateIapPurchase(productId, productId);
      if (result.success) {
        setSuccess(true);
        // Refresh subscription state
        try {
          const sub = await getSubscription();
          setSubscription(sub);
        } catch {}
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || "Purchase failed";
      if (!msg.includes("canceled") && !msg.includes("cancelled")) {
        setError(msg);
        setTimeout(() => setError(null), 5000);
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    setError(null);
    setRestoring(true);
    try {
      await restoreIapPurchases();
      // Refresh subscription
      const sub = await getSubscription();
      setSubscription(sub);
      if (sub?.plan?.slug !== "free") {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message || "Restore failed");
      setTimeout(() => setError(null), 5000);
    } finally {
      setRestoring(false);
    }
  };

  // Only render on mobile and for Free plan users
  // md:hidden ensures desktop users never see this  - they use Stripe
  return (
    <div class="md:hidden">
      <Show when={isFreePlan()}>
        <div
          class="relative overflow-hidden rounded-xl"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {/* Gradient accent bar */}
          <div
            class="h-1 w-full"
            style={{
              background: "linear-gradient(90deg, var(--color-accent), #8b5cf6, #ec4899)",
            }}
          />

          <div class="px-5 pt-5 pb-4 flex flex-col gap-4">
            {/* Header */}
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(59, 130, 246, 0.15)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div>
                <h3
                  class="text-[16px] font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  Upgrade to Pro
                </h3>
                <p
                  class="text-[12px]"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Unlock all premium features
                </p>
              </div>
            </div>

            {/* Features List */}
            <div class="flex flex-col gap-2">
              <Feature icon="⚡" label="Channel bonding" description="Combine connections for speed" />
              <Feature icon="🛡️" label="Ad & tracker blocking" description="System-wide DNS protection" />
              <Feature icon="🌐" label="All server locations" description="Access premium relays worldwide" />
              <Feature icon="📱" label="Up to 5 devices" description="One subscription, all devices" />
              <Feature icon="♾️" label="Unlimited bandwidth" description="No data caps or throttling" />
            </div>

            {/* Billing Interval Toggle */}
            <div
              class="flex rounded-lg p-1"
              style={{
                background: "var(--color-surface-hover)",
                border: "1px solid var(--color-border)",
              }}
            >
              <button
                class="flex-1 py-2 rounded-md text-[13px] font-medium transition-all duration-200"
                style={{
                  background: selectedInterval() === "monthly" ? "var(--color-accent)" : "transparent",
                  color: selectedInterval() === "monthly" ? "#fff" : "var(--color-text-dim)",
                }}
                onClick={() => setSelectedInterval("monthly")}
              >
                Monthly
              </button>
              <button
                class="flex-1 py-2 rounded-md text-[13px] font-medium transition-all duration-200 relative"
                style={{
                  background: selectedInterval() === "yearly" ? "var(--color-accent)" : "transparent",
                  color: selectedInterval() === "yearly" ? "#fff" : "var(--color-text-dim)",
                }}
                onClick={() => setSelectedInterval("yearly")}
              >
                Yearly
                <span
                  class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: selectedInterval() === "yearly" ? "rgba(255,255,255,0.2)" : "rgba(16, 185, 129, 0.15)",
                    color: selectedInterval() === "yearly" ? "#fff" : "var(--color-success)",
                  }}
                >
                  -40%
                </span>
              </button>
            </div>

            {/* Price Display */}
            <div class="text-center py-2">
              <Show when={selectedInterval() === "monthly"}>
                <div class="flex items-baseline justify-center gap-1">
                  <span class="text-3xl font-bold" style={{ color: "var(--color-text)" }}>$9.99</span>
                  <span class="text-[13px]" style={{ color: "var(--color-text-dim)" }}>/month</span>
                </div>
              </Show>
              <Show when={selectedInterval() === "yearly"}>
                <div class="flex items-baseline justify-center gap-1">
                  <span class="text-3xl font-bold" style={{ color: "var(--color-text)" }}>$5.99</span>
                  <span class="text-[13px]" style={{ color: "var(--color-text-dim)" }}>/month</span>
                </div>
                <p class="text-[11px] mt-1" style={{ color: "var(--color-text-dim)" }}>
                  $71.88 billed annually
                </p>
              </Show>
            </div>

            {/* Subscribe Button */}
            <button
              class="w-full py-3.5 rounded-lg text-[15px] font-semibold transition-all duration-200 active:scale-[0.98]"
              style={{
                background: purchasing()
                  ? "var(--color-surface-hover)"
                  : "linear-gradient(135deg, var(--color-accent), #7c3aed)",
                color: "#fff",
                opacity: purchasing() ? "0.7" : "1",
                "box-shadow": purchasing() ? "none" : "0 4px 14px rgba(59, 130, 246, 0.3)",
              }}
              disabled={!!purchasing()}
              onClick={() => {
                const suffix = selectedInterval() === "yearly" ? "yearly" : "monthly";
                const productId = products().find(p => p.billing_period === (suffix === "yearly" ? "P1Y" : "P1M"))?.id
                  || `tunnely_pro_${suffix}`;
                handlePurchase(productId);
              }}
            >
              <Show when={purchasing()} fallback="Subscribe to Pro">
                <span class="flex items-center justify-center gap-2">
                  <span
                    class="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ "border-color": "rgba(255,255,255,0.3)", "border-top-color": "#fff" }}
                  />
                  Processing...
                </span>
              </Show>
            </button>

            {/* Restore Purchases */}
            <button
              class="w-full py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={{
                color: "var(--color-text-dim)",
                background: "transparent",
              }}
              disabled={restoring()}
              onClick={handleRestore}
            >
              <Show when={restoring()} fallback="Restore Previous Purchase">
                Restoring...
              </Show>
            </button>

            {/* Error / Success Alerts */}
            <Show when={error()}>
              <div
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "var(--color-danger)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error()}
              </div>
            </Show>

            <Show when={success()}>
              <div
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "var(--color-success)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Subscription activated! Enjoy Pro.
              </div>
            </Show>

            {/* Fine Print */}
            <p
              class="text-[10px] text-center leading-relaxed"
              style={{ color: "var(--color-text-dim)", opacity: "0.7" }}
            >
              Payment is charged through your app store account.
              <br />
              Subscription auto-renews unless canceled 24 hours before renewal.
            </p>
          </div>
        </div>
      </Show>

      {/* Already Pro  - compact badge */}
      <Show when={isPremium()}>
        <div
          class="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.15)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <span class="text-[13px] font-medium" style={{ color: "var(--color-text)" }}>
              {subscription()?.plan?.name || "Pro"} Plan Active
            </span>
            <Show when={subscription()?.current_period_end}>
              <p class="text-[11px]" style={{ color: "var(--color-text-dim)" }}>
                Renews {new Date(subscription()!.current_period_end!).toLocaleDateString()}
              </p>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

function Feature(props: { icon: string; label: string; description: string }) {
  return (
    <div class="flex items-center gap-3">
      <span class="text-[16px] w-6 text-center shrink-0">{props.icon}</span>
      <div class="flex flex-col">
        <span class="text-[13px] font-medium" style={{ color: "var(--color-text)" }}>
          {props.label}
        </span>
        <span class="text-[11px]" style={{ color: "var(--color-text-dim)" }}>
          {props.description}
        </span>
      </div>
    </div>
  );
}
