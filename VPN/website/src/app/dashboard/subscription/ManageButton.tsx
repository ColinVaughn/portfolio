"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ExternalLink } from "lucide-react";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  const handleManage = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleManage} disabled={loading} variant="outline">
      {loading ? "Loading..." : "Manage Billing"}
      <ExternalLink className="w-4 h-4" />
    </Button>
  );
}
