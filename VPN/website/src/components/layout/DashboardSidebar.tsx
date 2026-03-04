"use client";

import { useState, useEffect } from "react";
import { PrefetchLink as Link } from "@/components/ui/PrefetchLink";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  LogOut,
  ShieldAlert,
  Wrench,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/subscription", icon: CreditCard, label: "Subscription" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("user");

  useEffect(() => {
    const fetchRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        if (data) setRole(data.role);
      }
    };
    fetchRole();
  }, []);

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
    { href: "/dashboard/subscription", icon: CreditCard, label: "Subscription" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  ];

  if (role === "admin" || role === "integrator") {
    navItems.push({ href: "/dashboard/integrator", icon: Wrench, label: "Integrator" });
  }
  if (role === "admin") {
    navItems.push({ href: "/dashboard/admin", icon: ShieldAlert, label: "Admin" });
    navItems.push({ href: "/dashboard/admin/blog", icon: FileText, label: "Blog CMS" });
  }

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="w-64 border-r border-white/[0.08] bg-[#121212] min-h-screen p-6 flex flex-col">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 mb-10 group">
        <div className="w-2 h-2 bg-primary rounded-none" />
        <span className="text-[17px] font-black text-white tracking-tight uppercase">
          Tunnely
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-colors",
                isActive
                  ? "bg-white/[0.08] text-white border-l-2 border-primary"
                  : "text-text-dim border-l-2 border-transparent hover:text-white hover:bg-white/[0.04] hover:border-white/[0.08]"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-text-dim hover:text-[#EF4444] hover:bg-[#EF4444]/10 border-l-2 border-transparent hover:border-[#EF4444] transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </aside>
  );
}
