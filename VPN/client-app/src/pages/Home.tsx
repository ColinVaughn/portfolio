import { createSignal, Show, onMount } from "solid-js";
import ConnectButton from "../components/ConnectButton";
import StatusBar from "../components/StatusBar";
import ServerPicker from "../components/ServerPicker";
import {
  servers,
  selectedServerId,
  setServers,
  user,
  isConnected,
} from "../lib/stores";
import { fetchServers, logout } from "../lib/tauri";
import type { RelayServer } from "../lib/types";

export default function Home() {
  const [showServerPicker, setShowServerPicker] = createSignal(false);

  onMount(async () => {
    try {
      const s = await fetchServers();
      setServers(s);
    } catch (err) {
      console.error("Failed to fetch servers:", err);
    }
  });

  const selectedServer = (): RelayServer | null => {
    const id = selectedServerId();
    if (!id) return null;
    return servers().find((s) => s.id === id) ?? null;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <Show
      when={!showServerPicker()}
      fallback={<ServerPicker onClose={() => setShowServerPicker(false)} />}
    >
      <div class="flex flex-col h-screen">
        {/* Top bar */}
        <div class="flex items-center justify-between p-4">
          <div>
            <span class="text-sm" style="color: var(--color-text-dim)">
              {user()?.email}
            </span>
          </div>
          <button
            onClick={handleLogout}
            class="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-text-dim)",
              border: "1px solid var(--color-border)",
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Main area - connect button */}
        <div class="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <ConnectButton selectedServerId={selectedServerId()} />
        </div>

        {/* Bottom section - server selector + status */}
        <div class="p-4 space-y-3">
          {/* Server selector button */}
          <button
            onClick={() => setShowServerPicker(true)}
            disabled={isConnected()}
            aria-label="Select connection server"
            aria-haspopup="dialog"
            class="w-full flex flex-row items-center justify-between px-4 py-3 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div class="flex items-center gap-3">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                style="color: var(--color-text-dim)"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span class="text-sm">
                {selectedServer()
                  ? `${selectedServer()!.city}, ${selectedServer()!.country_code}`
                  : "Auto (Best Server)"}
              </span>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              style="color: var(--color-text-dim)"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Connection status */}
          <StatusBar />
        </div>
      </div>
    </Show>
  );
}
