import { Show, For, onMount, onCleanup, createSignal, createMemo } from "solid-js";
import { 
  user, preferences, setPreferences, isConnected, subscription, canBond, planDisplayName, 
  isFreePlan, adblockStatus, setAdblockStatus, adblockStats, setAdblockStats, 
  adblockWhitelist, setAdblockWhitelist, canAdblockClient, canAdblockCosmetic, canAdblockCustom,
  updateInfo, setUpdateInfo,
} from "../lib/stores";
import { 
  logout, savePreferences, loadPreferences, getBondingStatus, toggleChannelEnabled, 
  setBondingMode, getLocalInterfaces, getAdblockStatus, getAdblockStats, enableAdblock, 
  disableAdblock, setAdblockFilterLevel, installAdblockCa, updateAdblockFilters, 
  getAdblockWhitelist, addAdblockWhitelist, removeAdblockWhitelist, setAdblockDebugLogging,
  checkForUpdates,
} from "../lib/tauri";
import type { ChannelStatus } from "../lib/types";
import type { LocalInterface } from "../lib/tauri";
import MobilePaywall from "../components/MobilePaywall";
import { isPageVisible, isMobilePlatform } from "../lib/usePageVisibility";

export default function SettingsPage() {
  onMount(async () => {
    try {
      const prefs = await loadPreferences();
      setPreferences(prefs);
    } catch {
      // use defaults
    }
  });

  // Local interfaces (always available, even before connecting)
  const [localInterfaces, setLocalInterfaces] = createSignal<LocalInterface[]>([]);
  // Live bonding channels (only when connected)
  const [channels, setChannels] = createSignal<ChannelStatus[]>([]);
  let pollInterval: ReturnType<typeof setInterval>;

  const refresh = async () => {
    if (!isPageVisible()) return;
    try {
      const ifaces = await getLocalInterfaces();
      setLocalInterfaces(ifaces);
    } catch { /* ignore */ }
    if (isConnected()) {
      try {
        const statuses = await getBondingStatus();
        setChannels(statuses);
      } catch { /* ignore */ }
    } else {
      setChannels([]);
    }
  };

  onMount(() => {
    refresh();
    const pollMs = isMobilePlatform() ? 10000 : 3000;
    pollInterval = setInterval(refresh, pollMs);

    // Initial fetch for Adblock state
    getAdblockStatus().then(setAdblockStatus).catch(() => {});
    getAdblockStats().then(setAdblockStats).catch(() => {});
    getAdblockWhitelist().then(setAdblockWhitelist).catch(() => {});
  });
  onCleanup(() => clearInterval(pollInterval));

  const refreshAdblock = async () => {
    try {
      const [status, stats, whitelist] = await Promise.all([
        getAdblockStatus(),
        getAdblockStats(),
        getAdblockWhitelist(),
      ]);
      setAdblockStatus(status);
      setAdblockStats(stats);
      setAdblockWhitelist(whitelist);
    } catch {}
  };

  // Merge: when connected, show live channel data; otherwise show local interfaces
  const displayInterfaces = createMemo(() => {
    if (isConnected() && channels().length > 0) {
      return channels().map(ch => ({
        name: ch.name,
        interface_type: ch.interface_type,
        ip: "",
        state: ch.state,
        rtt_ms: ch.rtt_ms,
        throughput_kbps: ch.throughput_kbps,
        loss_pct: ch.loss_pct,
        enabled: ch.enabled,
        id: ch.id,
        isLive: true,
      }));
    }
    return localInterfaces().map((iface, i) => ({
      name: iface.name,
      interface_type: iface.interface_type,
      ip: iface.ip,
      state: "Available",
      rtt_ms: 0,
      throughput_kbps: 0,
      loss_pct: 0,
      enabled: true,
      id: i,
      isLive: false,
    }));
  });

  const updatePref = async (
    key: keyof ReturnType<typeof preferences>,
    value: any
  ) => {
    const updated = { ...preferences(), [key]: value };
    setPreferences(updated);
    try {
      await savePreferences(updated);
    } catch (err) {
      console.error("Failed to save preferences:", err);
    }
  };

  const handleLogout = async () => {
    try {
      const { setUser } = await import("../lib/stores");
      await logout();
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const [whitelistInput, setWhitelistInput] = createSignal("");
  const [caInstallStatus, setCaInstallStatus] = createSignal("");
  const [updateStatus, setUpdateStatus] = createSignal("");

  return (
    <div class="flex flex-col h-full overflow-y-auto px-6 py-8 md:px-10 lg:py-12 w-full relative">
      {/* Background ambient light */}
      <div 
        class="fixed top-0 left-0 w-full h-96 opacity-10 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 0%, var(--color-accent), transparent 70%)"
        }}
      />

      <div class="relative z-10 w-full flex flex-col mx-auto max-w-[1400px]">
        <div class="mb-10 px-2 border-b border-border pb-6">
          <h1 class="text-4xl tracking-tight font-light text-text">Preferences</h1>
          <p class="text-[14px] mt-2 text-text-dim">Manage your VPN connection and application behavior.</p>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-x-12 gap-y-12">
          
          {/* LEFT COLUMN */}
          <div class="flex flex-col space-y-12 min-w-0">
            {/* Connection */}
            <SettingsSection title="Connection">
              <SettingSelect
                label="Channel Bonding Mode"
                description={canBond() ? "Select how multiple network interfaces are used" : "Upgrade to Pro to enable channel bonding"}
                value={canBond() ? (preferences().bonding_mode || "Speed") : "None"}
                options={canBond() ? [
                  { value: "None", label: "Disabled (Single Interface)" },
                  { value: "Speed", label: "Speed (Load Balancing)" },
                  { value: "Redundant", label: "Redundant (Lowest Latency)" },
                  { value: "Quality", label: "Quality (Smart Routing)" }
                ] : [
                  { value: "None", label: "Requires Pro Plan" }
                ]}
                onChange={(v) => {
                  if (canBond()) updatePref("bonding_mode", v);
                }}
                disabled={!canBond()}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                }
              />
              {/* Upgrade prompt for Free users */}
              <Show when={!canBond()}>
                <div class="px-6 pb-4 -mt-2">
                  <div
                    class="flex items-center gap-3 px-4 py-3 rounded text-sm"
                    style={{
                      background: "rgba(59, 130, 246, 0.1)",
                      "border-left": "3px solid var(--color-accent)",
                      color: "var(--color-text-dim)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>Channel bonding combines connections. <strong class="text-accent">Upgrade to Pro</strong> to unlock.</span>
                  </div>
                </div>
              </Show>

              {/* Network Interfaces */}
              <Show when={preferences().bonding_mode && preferences().bonding_mode !== "None"}>
                <div class="setting-interfaces">
                  <div class="interfaces-header">
                    <div class="interfaces-label">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      <div>
                        <div class="interfaces-title">Network Interfaces</div>
                        <div class="interfaces-desc">
                          {isConnected()
                            ? "Toggle which connections are used for bonding"
                            : "These interfaces will be used when you connect"
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  <Show when={displayInterfaces().length > 0}
                    fallback={
                      <div class="interfaces-empty">No network interfaces found</div>
                    }>
                    <div class="interfaces-list">
                      <For each={displayInterfaces()}>
                        {(iface) => {
                          const typeIcon = () => {
                            switch (iface.interface_type) {
                              case "WiFi": return "📶";
                              case "Ethernet": return "🔌";
                              case "Cellular": return "📱";
                              default: return "🌐";
                            }
                          };
                          const stateColor = () => {
                            switch (iface.state) {
                              case "Active": return "#3b82f6";
                              case "Available": return "#22c55e";
                              case "Degraded": return "#f59e0b";
                              case "Failed": return "#ef4444";
                              case "Initializing": return "#8b5cf6";
                              case "Disabled": return "rgba(255,255,255,0.3)";
                              default: return "rgba(255,255,255,0.5)";
                            }
                          };
                          return (
                            <div class="iface-row" classList={{ "iface-disabled": !iface.enabled }}>
                              <div class="iface-info">
                                <span class="iface-icon">{typeIcon()}</span>
                                <div class="iface-details">
                                  <div class="iface-name">
                                    {iface.name}
                                    {iface.ip && <span class="iface-ip">{iface.ip}</span>}
                                    <span class="iface-state" style={{ color: stateColor() }}>{iface.state}</span>
                                  </div>
                                  <Show when={iface.isLive}>
                                    <div class="iface-metrics">
                                      {iface.rtt_ms}ms · {iface.throughput_kbps} kbps · {iface.loss_pct.toFixed(1)}% loss
                                    </div>
                                  </Show>
                                </div>
                              </div>
                              <Show when={iface.isLive}>
                                <button
                                  class="iface-toggle"
                                  classList={{ "toggle-on": iface.enabled, "toggle-off": !iface.enabled }}
                                  onClick={async () => {
                                    await toggleChannelEnabled(iface.id, !iface.enabled);
                                    refresh();
                                  }}
                                  title={iface.enabled ? "Disable this interface" : "Enable this interface"}
                                  aria-label={iface.enabled ? `Disable ${iface.name} interface` : `Enable ${iface.name} interface`}
                                >
                                  <div class="toggle-knob" />
                                </button>
                              </Show>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>

              <SettingToggle
                label="Auto-connect on launch"
                description="Connect to the last server when the app starts"
                checked={preferences().auto_connect_on_launch}
                onChange={(v) => updatePref("auto_connect_on_launch", v)}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                }
              />
            </SettingsSection>

            {/* System */}
            <SettingsSection title="System">
              <SettingToggle
                label="Launch on startup"
                description="Start Tunnely when you log in"
                checked={preferences().launch_on_startup}
                onChange={(v) => updatePref("launch_on_startup", v)}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                }
              />
              <SettingToggle
                label="Minimize to tray"
                description="Keep running in the background when closed"
                checked={preferences().minimize_to_tray_on_close}
                onChange={(v) => updatePref("minimize_to_tray_on_close", v)}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                }
              />
              <SettingToggle
                label="Notifications"
                description="Show alerts on connect and disconnect"
                checked={preferences().notifications_enabled}
                onChange={(v) => updatePref("notifications_enabled", v)}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                }
              />
            </SettingsSection>
          </div>

          {/* RIGHT COLUMN */}
          <div class="flex flex-col space-y-12 min-w-0">
            {/* Ad Blocker */}
            <SettingsSection title="Ad Blocker & Privacy">
              <SettingToggle
                label="Enable Ad Blocker"
                description={canAdblockClient() ? "Block ads and trackers system-wide" : "Upgrade to Pro to unlock the Ad Blocker"}
                checked={preferences().adblock_enabled}
                onChange={async (v) => {
                  if (!canAdblockClient()) return;
                  await updatePref("adblock_enabled", v);
                  if (v) {
                    await enableAdblock().catch(console.error);
                  } else {
                    await disableAdblock().catch(console.error);
                  }
                  await refreshAdblock();
                }}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                  </svg>
                }
              />
              <Show when={!canAdblockClient()}>
                <div class="px-6 pb-4 -mt-2">
                  <div
                    class="flex items-center gap-3 px-4 py-3 rounded text-sm"
                    style={{
                      background: "rgba(59, 130, 246, 0.1)",
                      "border-left": "3px solid var(--color-accent)",
                      color: "var(--color-text-dim)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>System-wide ad blocking saves bandwidth and protects privacy. <strong class="text-accent">Upgrade to Pro</strong> to unlock.</span>
                  </div>
                </div>
              </Show>

              <Show when={preferences().adblock_enabled && canAdblockClient()}>
                <SettingSelect
                  label="Filter Level"
                  description="Choose how aggressively to block traffic"
                  value={preferences().adblock_filter_level || "Standard"}
                  options={[
                    { value: "Basic", label: "Basic (Fastest, fewest false positives)" },
                    { value: "Standard", label: "Standard (Recommended balance)" },
                    { value: "Strict", label: "Strict (Maximum privacy, may break sites)" },
                  ]}
                  onChange={async (v) => {
                    await updatePref("adblock_filter_level", v);
                    await setAdblockFilterLevel(v);
                  }}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                  }
                />
                
                <div class="px-6 py-4 flex flex-col gap-4 border-t border-border">
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-[var(--color-text-dim)]">Cosmetic Filtering (HTTPS)</span>
                    <Show when={canAdblockCosmetic()} fallback={<span class="text-[var(--color-accent)] font-medium">Pro Required</span>}>
                      <button 
                        class="px-4 py-2 rounded-lg bg-surface-hover hover:bg-white/15 transition-colors text-text font-medium disabled:opacity-50"
                        onClick={async () => {
                          setCaInstallStatus("Installing...");
                          try {
                            const result = await installAdblockCa();
                            setCaInstallStatus("Installed!");
                            setTimeout(() => setCaInstallStatus(""), 3000);
                          } catch (e) {
                            setCaInstallStatus("Failed");
                            setTimeout(() => setCaInstallStatus(""), 3000);
                          }
                        }}
                      >
                        {caInstallStatus() || "Install Root CA"}
                      </button>
                    </Show>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-[var(--color-text-dim)]">Filter Lists</span>
                    <div class="flex items-center gap-3">
                      <span class="text-xs text-[var(--color-text-dim)]">{updateStatus()}</span>
                      <button 
                        class="px-4 py-2 rounded-lg bg-surface-hover hover:bg-white/15 transition-colors text-text font-medium"
                        onClick={async () => {
                          setUpdateStatus("Updating...");
                          try {
                            const count = await updateAdblockFilters();
                            setUpdateStatus(`Loaded ${count} rules`);
                            setTimeout(() => setUpdateStatus(""), 4000);
                          } catch (e) {
                            setUpdateStatus("Update failed");
                            setTimeout(() => setUpdateStatus(""), 4000);
                          }
                        }}
                      >
                        Update Now
                      </button>
                    </div>
                  </div>
                </div>

                {/* Whitelist Manager */}
                <div class="px-6 py-4 border-t border-border flex flex-col gap-3">
                  <span class="text-[14px] font-semibold text-text">Whitelist Domains</span>
                  <p class="text-[13px] text-[var(--color-text-dim)]">
                    {canAdblockCustom() ? "Domains that should bypass all blocking." : "Upgrade to Pro to customize the whitelist."}
                  </p>
                  
                  <Show when={canAdblockCustom()}>
                    <form 
                      class="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (whitelistInput().trim()) {
                          await addAdblockWhitelist(whitelistInput().trim());
                          setWhitelistInput("");
                          await refreshAdblock();
                        }
                      }}
                    >
                      <input 
                        type="text" 
                        placeholder="e.g. google.com"
                        value={whitelistInput()}
                        onInput={(e) => setWhitelistInput(e.currentTarget.value)}
                        class="flex-1 text-[13px] font-medium px-4 py-2 rounded focus:outline-none focus:border-accent bg-surface-hover border border-border text-text transition-colors"
                      />
                      <button type="submit" class="px-4 py-2 bg-surface-hover hover:bg-white/20 text-text rounded font-medium text-sm transition-colors border border-border">
                        Add
                      </button>
                    </form>
                    <div class="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                      <For each={adblockWhitelist()}>
                        {(domain) => (
                          <div class="flex items-center gap-2 bg-surface border border-border rounded px-2 py-1 text-xs">
                            <span class="text-text/">{domain}</span>
                            <button 
                              class="text-[var(--color-text-dim)] hover:text-text transition-colors"
                              aria-label={`Remove ${domain} from whitelist`}
                              title={`Remove ${domain}`}
                              onClick={async () => {
                                await removeAdblockWhitelist(domain);
                                await refreshAdblock();
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* Debug Log & Stats */}
                <SettingToggle
                  label="Debug Live Log"
                  description="Developer tool: view blocked and allowed requests in real-time"
                  checked={adblockStats()?.debug_logging_enabled || false}
                  onChange={async (v) => {
                    await setAdblockDebugLogging(v);
                    await refreshAdblock();
                  }}
                />

                <Show when={adblockStats()?.debug_logging_enabled}>
                  <div class="px-6 py-4 border-t border-border bg-surface flex flex-col gap-2">
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dim)]">Live Traffic</span>
                      <button 
                        class="text-xs text-[var(--color-accent)] hover:underline"
                        onClick={refreshAdblock}
                      >
                        Refresh
                      </button>
                    </div>
                    <div class="h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 font-mono text-[10px]">
                      <Show when={(adblockStats()?.recent_blocked?.length || 0) === 0}>
                        <div class="text-center py-4 text-text/ italic">No recent activity. Refresh the page to see live traffic.</div>
                      </Show>
                      <For each={[...(adblockStats()?.recent_blocked || [])].reverse()}>
                        {(entry) => (
                          <div class="flex gap-2 items-start py-1 border-b border-border break-all">
                            <span class="w-12 shrink-0 opacity-50 text-right">{new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}</span>
                            <span class="w-12 shrink-0 font-bold" style={{ color: entry.filter_rule ? "var(--color-danger)" : "var(--color-success)" }}>
                              {entry.filter_rule ? "BLOCK" : "ALLOW"}
                            </span>
                            <span class="flex-1 opacity-80">{entry.url}</span>
                            <Show when={entry.filter_rule}>
                              <span class="text-[8px] bg-danger/20 text-danger px-1.5 py-0.5 rounded leading-none shrink-0 self-center border border-danger/30">
                                {entry.filter_rule}
                              </span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* General Stats summary */}
                <div class="px-6 py-4 flex gap-4 border-t border-border bg-surface">
                  <div class="flex flex-col flex-1">
                    <span class="text-[10px] uppercase text-text/ font-bold tracking-widest">Blocked</span>
                    <span class="font-mono text-text text-sm">{adblockStats()?.requests_blocked || 0}</span>
                  </div>
                  <div class="flex flex-col flex-1">
                    <span class="text-[10px] uppercase text-text/ font-bold tracking-widest">Rate</span>
                    <span class="font-mono text-text text-sm">{adblockStats()?.block_rate_percent || 0}%</span>
                  </div>
                  <div class="flex flex-col flex-1">
                    <span class="text-[10px] uppercase text-text/ font-bold tracking-widest">Saved</span>
                    <span class="font-mono text-text text-sm">{adblockStats()?.bytes_saved ? ((adblockStats()!.bytes_saved / 1024).toFixed(1) + " KB") : "0 B"}</span>
                  </div>
                </div>

              </Show>
            </SettingsSection>

            {/* Appearance */}
            <SettingsSection title="Appearance">
              <SettingSelect
                label="Theme"
                description="Choose application color scheme"
                value={preferences().theme || "system"}
                onChange={(code) => updatePref("theme", code)}
                options={[
                  { value: "system", label: "System Default" },
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-80" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                }
              />
            </SettingsSection>

            {/* Security */}
            <SettingsSection title="Security">
              <SettingToggle
                label="Kill switch"
                description="Block internet if VPN connection drops"
                checked={preferences().kill_switch_enabled}
                onChange={(v) => updatePref("kill_switch_enabled", v)}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                }
              />
              <SettingInput
                label="Custom DNS"
                placeholder="e.g. 1.1.1.1, 8.8.8.8"
                value={preferences().custom_dns ?? ""}
                onChange={(v) => updatePref("custom_dns", v || null)}
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                }
              />
            </SettingsSection>

            {/* Account & About */}
            <SettingsSection title="Account">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-6 hover:bg-surface transition-colors group gap-4">
                <div class="flex items-center gap-4 min-w-0">
                  <div class="w-12 h-12 rounded flex items-center justify-center shrink-0 border border-border" style="background: var(--color-surface-hover); color: var(--color-text);">
                    <span class="font-bold text-lg">{user()?.email?.charAt(0).toUpperCase() || "U"}</span>
                  </div>
                  <div>
                    <div class="text-[15px] font-semibold text-text">{user()?.email}</div>
                    <div class="text-[12px] mt-1 flex items-center gap-2 text-text-dim">
                      <span class="w-1.5 h-1.5 rounded-full" style={{
                        background: subscription()?.status === "active" || subscription()?.status === "trialing"
                          ? "var(--color-success)"
                          : subscription()?.status === "past_due"
                            ? "var(--color-warning)"
                            : "var(--color-text-dim)",
                      }} />
                      {subscription()?.status === "active" ? "Active" 
                        : subscription()?.status === "trialing" ? "Trial" 
                        : subscription()?.status === "past_due" ? "Past Due" 
                        : subscription()?.status === "canceled" ? "Canceled"
                        : "Free Plan"}
                      {subscription()?.cancel_at_period_end && " · Cancels at period end"}
                    </div>
                    {/* Plan features */}
                    <Show when={subscription()?.plan?.features}>
                      <div class="flex flex-wrap gap-1 mt-2">
                        {(Array.isArray(subscription()?.plan?.features) 
                          ? subscription()!.plan.features 
                          : []
                        ).slice(0, 4).map((feature: string) => (
                          <span
                            class="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-dim bg-surface"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </Show>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  class="text-[13px] font-medium px-4 py-2 rounded transition-colors hover:bg-danger hover:text-text border border-danger/30 text-danger shrink-0"
                >
                  Sign Out
                </button>
              </div>
            </SettingsSection>

            {/* Mobile In-App Purchase Paywall */}
            <MobilePaywall />

            <SettingsSection title="System Information">
              <div class="flex flex-col px-6 py-6 gap-1.5 hover:bg-surface transition-colors">
                <div class="flex items-center justify-between">
                  <div class="text-[15px] font-semibold text-text">Tunnely Application</div>
                  <div 
                    class="text-[11px] font-bold tracking-widest px-2 py-0.5 rounded border"
                    style={{
                      background: isFreePlan() ? "transparent" : "rgba(59,130,246,0.1)",
                      color: isFreePlan() ? "var(--color-text-dim)" : "var(--color-accent)",
                      "border-color": isFreePlan() ? "var(--color-border)" : "rgba(59,130,246,0.2)",
                    }}
                  >
                    {planDisplayName().toUpperCase()}
                  </div>
                </div>
                <div class="text-[13px] text-text-dim">
                  Version 0.1.2
                </div>
              </div>
              <div class="flex items-center justify-between px-6 py-4 border-t border-border hover:bg-surface transition-colors">
                <div class="flex flex-col">
                  <div class="text-[14px] font-medium text-text">Software Updates</div>
                  <div class="text-[12px] text-text-dim mt-0.5">
                    <Show when={updateInfo()?.update_available}
                      fallback="You're up to date"
                    >
                      v{updateInfo()!.latest_version} is available
                    </Show>
                  </div>
                </div>
                <button
                  class="text-[13px] font-medium px-4 py-2 rounded transition-colors border border-border hover:border-accent hover:text-accent text-text-dim"
                  onClick={async () => {
                    try {
                      const info = await checkForUpdates();
                      setUpdateInfo(info);
                    } catch (err) {
                      console.error("Update check failed:", err);
                    }
                  }}
                >
                  Check for Updates
                </button>
              </div>
            </SettingsSection>
          </div>

        </div>
      </div>

      {/* Interface list styles */}
      <style>{`
        .setting-interfaces {
          padding: 16px 24px;
        }
        .interfaces-header {
          margin-bottom: 12px;
        }
        .interfaces-label {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          color: var(--color-text-dim);
        }
        .interfaces-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text);
        }
        .interfaces-desc {
          font-size: 13px;
          color: var(--color-text-dim);
          opacity: 0.8;
          margin-top: 2px;
        }
        .interfaces-empty {
          font-size: 13px;
          color: var(--color-text-dim);
          opacity: 0.5;
          font-style: italic;
          padding: 8px 0;
        }
        .interfaces-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .iface-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-radius: 4px;
          background: var(--color-surface-hover);
          border: 1px solid var(--color-surface);
          transition: opacity 0.2s;
        }
        .iface-row.iface-disabled {
          opacity: 0.4;
        }
        .iface-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .iface-icon {
          font-size: 16px;
          opacity: 0.8;
        }
        .iface-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .iface-name {
          font-size: 13px;
          font-weight: 500;
          color: #e4e4ed;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .iface-state {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .iface-ip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          opacity: 0.5;
        }
        .iface-metrics {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.3);
        }
        .iface-toggle {
          width: 32px;
          height: 18px;
          border-radius: 2px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .iface-toggle.toggle-on {
          background: var(--color-accent);
        }
        .iface-toggle.toggle-off {
          background: var(--color-border);
        }
        .iface-toggle .toggle-knob {
          width: 14px;
          height: 14px;
          border-radius: 2px;
          background: white;
          position: absolute;
          top: 2px;
          transition: left 0.2s;
        }
        .iface-toggle.toggle-on .toggle-knob {
          left: 16px;
        }
        .iface-toggle.toggle-off .toggle-knob {
          left: 2px;
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───

function SettingsSection(props: { title: string; children: any }) {
  return (
    <div class="flex flex-col gap-3 relative">
      <h3
        class="text-[11px] font-bold uppercase tracking-widest text-text-dim"
      >
        {props.title}
      </h3>
      <div
        class="border border-border rounded backdrop-blur-md w-full"
        style={{
          background: "rgba(255, 255, 255, 0.015)",
        }}
      >
        <div class="divide-y divide-white/10">
          {props.children}
        </div>
      </div>
    </div>
  );
}

function SettingToggle(props: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon?: any;
}) {
  return (
    <label class="flex items-center justify-between px-6 py-5 transition-colors hover:bg-surface cursor-pointer group">
      <div class="flex items-center gap-4 flex-1 min-w-0 mr-6">
        <Show when={props.icon}>
          <div 
            class="w-10 h-10 rounded flex items-center justify-center shrink-0 border border-border"
            style={{ 
              background: "var(--color-surface)",
              color: "var(--color-text-dim)",
            }}
          >
            {props.icon}
          </div>
        </Show>
        <div class="flex flex-col min-w-0">
          <div class="text-[14px] font-medium truncate transition-colors duration-200 text-text">
            {props.label}
          </div>
          <Show when={props.description}>
            <div class="text-[12px] mt-0.5 text-text-dim opacity-80">
              {props.description}
            </div>
          </Show>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        onClick={(e) => {
          e.preventDefault();
          props.onChange(!props.checked);
        }}
        class="relative w-10 h-5 rounded-[2px] transition-all duration-300 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{
          background: props.checked
            ? "var(--color-accent)"
            : "var(--color-surface-hover)",
          "box-shadow": props.checked ? "none" : "inset 0 0 0 1px var(--color-border)",
        }}
      >
        <span class="sr-only">{props.label}</span>
        <div
          class="absolute top-[2px] w-[16px] h-[16px] rounded-[1px] transition-transform duration-300 shadow-sm"
          style={{
            background: props.checked ? "#ffffff" : "var(--color-text-dim)",
            transform: props.checked ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </button>
    </label>
  );
}

function SettingInput(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon?: any;
}) {
  return (
    <div class="flex items-center justify-between px-6 py-5 transition-colors hover:bg-surface">
      <div class="flex items-center gap-4 shrink-0 min-w-0 mr-6">
        <Show when={props.icon}>
          <div 
            class="w-10 h-10 rounded flex items-center justify-center shrink-0 border border-border"
            style={{ 
              background: "var(--color-surface)",
              color: "var(--color-text-dim)",
            }}
          >
            {props.icon}
          </div>
        </Show>
        <label class="text-[14px] font-medium truncate text-text" for={`input-${props.label.replace(/\s+/g, '-')}`}>
          {props.label}
        </label>
      </div>
      <input
        id={`input-${props.label.replace(/\s+/g, '-')}`}
        type="text"
        placeholder={props.placeholder}
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        class="text-[13px] font-mono text-left px-3 py-2 rounded focus:outline-none focus:border-accent w-64 transition-all border border-border text-text"
        style={{ background: "var(--color-surface-hover)" }}
      />
    </div>
  );
}

function SettingSelect(props: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: any;
  disabled?: boolean;
}) {
  return (
    <div class="flex items-center justify-between px-6 py-5 transition-colors hover:bg-surface" style={{ opacity: props.disabled ? "0.5" : "1" }}>
      <div class="flex items-center gap-4 shrink-0 min-w-0 mr-6 w-1/2">
        <Show when={props.icon}>
          <div 
            class="w-10 h-10 rounded flex items-center justify-center shrink-0 border border-border"
            style={{ 
              background: "var(--color-surface)",
              color: "var(--color-text-dim)",
            }}
          >
            {props.icon}
          </div>
        </Show>
        <div class="flex flex-col min-w-0">
          <label class="text-[14px] font-medium truncate text-text" for={`select-${props.label.replace(/\s+/g, '-')}`}>
            {props.label}
          </label>
          <Show when={props.description}>
            <div class="text-[12px] mt-0.5 text-text-dim opacity-80">
              {props.description}
            </div>
          </Show>
        </div>
      </div>
      <select
        id={`select-${props.label.replace(/\s+/g, '-')}`}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange((e.target as HTMLSelectElement).value)}
        class="text-[13px] font-medium text-left px-3 py-2 rounded focus:outline-none focus:border-accent w-auto min-w-[200px] transition-all border border-border text-text appearance-none cursor-pointer"
        style={{
          background: "var(--color-surface-hover)",
          cursor: props.disabled ? "not-allowed" : "pointer",
        }}
      >
        {props.options.map((opt) => (
          <option value={opt.value} style="background: #111; color: white;">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
