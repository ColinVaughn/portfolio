import { useLocation, useNavigate, A } from "@solidjs/router";
import { user, isConnected, connectionState, planDisplayName, isFreePlan } from "../lib/stores";
import { Show, createSignal } from "solid-js";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = createSignal(true); // Default collapsed

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      aria-label="Desktop primary"
      class={`hidden md:flex flex-col shrink-0 transition-all duration-300 relative ${
        collapsed() ? "w-[68px]" : "w-72"
      }`}
      style={{
        background: "var(--color-surface)",
        "border-right": "1px solid var(--color-border)",
      }}
    >
      {/* Background ambient glow matching status */}
      <div 
        class="absolute top-0 left-0 w-full h-48 opacity-[0.03] pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at 50% -20%, ${
            isConnected() ? "var(--color-success)" : 
            connectionState() === "connecting" ? "var(--color-warning)" :
            "var(--color-accent)"
          }, transparent 70%)`
        }}
      />

      {/* Collapse/Expand toggle - floats on the sidebar edge */}
      <button
        onClick={() => setCollapsed(!collapsed())}
        class="absolute top-4 -right-3.5 z-30 w-7 h-7 rounded-full flex items-center justify-center text-text-dim hover:text-text transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          "box-shadow": "0 2px 8px rgba(0,0,0,0.3)",
        }}
        title={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class={`transition-transform duration-300 ${collapsed() ? "" : "rotate-180"}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <div class="px-3 pt-4 flex flex-col gap-1.5 relative z-10">
        <SidebarItem href="/" active={isActive("/")} label="Dashboard" collapsed={collapsed()} navigate={navigate}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
        </SidebarItem>

        <SidebarItem href="/servers" active={isActive("/servers")} label="Global Servers" collapsed={collapsed()} navigate={navigate}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </SidebarItem>

        <SidebarItem href="/settings" active={isActive("/settings")} label="Preferences" collapsed={collapsed()} navigate={navigate}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </SidebarItem>
      </div>

      {/* Connection Quality Widget */}
      <div class="flex-1 mt-6 px-3 relative z-10 flex flex-col justify-end pb-4">
        <Show when={!collapsed()}>
          <Show when={isConnected()}>
            <div class="rounded-xl p-4 border relative overflow-hidden group" style="background: var(--color-surface); border-color: var(--color-border)">
              <div class="absolute inset-0 opacity-10 blur-xl group-hover:opacity-20 transition-opacity" style="background: var(--color-success)" />
              <div class="flex items-center justify-between relative z-10">
                <span class="text-[11px] font-semibold text-text-dim tracking-wider uppercase">Signal Strength</span>
                <div class="flex items-center gap-1">
                  <div class="w-1 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <div class="w-1 h-4 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <div class="w-1 h-5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <div class="w-1 h-6 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
              </div>
              <div class="mt-3 relative z-10">
                <div class="text-[10px] text-text-dim font-medium">Latency</div>
                <div class="text-emerald-400 font-bold text-sm tracking-wide mt-0.5">24ms <span class="text-xs font-normal opacity-70">Excellent</span></div>
              </div>
            </div>
          </Show>
          <Show when={!isConnected() && connectionState() !== "connecting"}>
            <div class="rounded-xl p-4 border border-dashed flex flex-col items-center justify-center text-center opacity-40 select-none" style="border-color: var(--color-border); min-height: 98px;">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mb-2">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
               </svg>
               <span class="text-[11px] font-medium tracking-wide">Disconnected</span>
            </div>
          </Show>
        </Show>
      </div>



      {/* Bottom Profile Section */}
      <div 
        class={`p-3 mx-2 mb-3 rounded-2xl border flex items-center gap-3 transition-all duration-300 cursor-pointer hover:bg-surface relative z-10 group ${
          collapsed() ? "justify-center" : "justify-between"
        }`}
        style={{ "border-color": "var(--color-border)", "background-color": "var(--color-surface-hover)" }}
      >
        <div class={`flex items-center gap-3 min-w-0 ${collapsed() ? "justify-center" : ""}`}>
          <div class="w-10 h-10 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
            <span class="text-accent font-bold text-sm tracking-wide">
              {user()?.email?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <Show when={!collapsed()}>
            <div class="flex flex-col min-w-0 justify-center gap-0.5">
              <p class="text-[13px] font-semibold truncate text-text leading-tight max-w-[120px]">
                {user()?.email || "Guest User"}
              </p>
              <div class="flex items-center gap-1.5">
                <span 
                  class="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: isFreePlan() ? "rgba(255,255,255,0.4)" : "rgb(52,211,153)",
                    "box-shadow": isFreePlan() ? "none" : "0 0 4px rgba(52,211,153,0.8)",
                  }}
                />
                <span 
                  class="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: isFreePlan() ? "rgba(255,255,255,0.5)" : "rgb(52,211,153)" }}
                >
                  {planDisplayName()}
                </span>
              </div>
            </div>
          </Show>
        </div>
        
        {/* Sign Out Button */}
        <Show when={!collapsed()}>
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const { logout } = await import("../lib/tauri");
                const { setUser, setSubscription } = await import("../lib/stores");
                await logout();
                setUser(null);
                setSubscription(null);
              } catch (err) {
                console.error("Logout failed:", err);
              }
            }}
            class="p-2 rounded-lg text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 opacity-0 group-hover:opacity-100 will-change-opacity"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </Show>
      </div>
    </nav>
  );
}

function SidebarItem(props: {
  href: string;
  active: boolean;
  label: string;
  collapsed: boolean;
  navigate: (path: string) => void;
  children: any;
}) {
  return (
    <button
      onClick={() => props.navigate(props.href)}
      aria-current={props.active ? "page" : undefined}
      title={props.collapsed ? props.label : undefined}
      class={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent w-full cursor-pointer ${
        props.collapsed ? "justify-center" : ""
      } ${
        props.active 
          ? "font-semibold shadow-sm" 
          : "font-medium opacity-80 hover:opacity-100"
      }`}
      style={{
        background: props.active ? "var(--color-surface-hover)" : "none",
        border: props.active ? "1px solid var(--color-border)" : "1px solid transparent",
        color: props.active ? "var(--color-text)" : "var(--color-text-dim)",
      }}
    >
      <div 
        class={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300`}
        style={{
          background: props.active ? "var(--color-surface)" : "transparent",
          border: props.active ? "1px solid var(--color-border)" : "1px solid transparent",
          color: props.active ? "var(--color-accent)" : "currentColor",
          "box-shadow": props.active ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
        }}
      >
        {props.children}
      </div>
      <Show when={!props.collapsed}>
        <span class="text-[14px] whitespace-nowrap">{props.label}</span>
      </Show>
    </button>
  );
}
