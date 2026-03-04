import { Show, onCleanup, createSignal, onMount } from "solid-js";
import {
  isConnected,
  connectionInfo,
  formatBytes,
  formatDuration,
} from "../lib/stores";
import { getConnectionStatus } from "../lib/tauri";
import { isPageVisible, isMobilePlatform } from "../lib/usePageVisibility";

export default function StatusBar() {
  const [stats, setStats] = createSignal<{
    bytes_tx: number;
    bytes_rx: number;
    duration_secs: number;
  } | null>(null);

  let interval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    const pollMs = isMobilePlatform() ? 5000 : 1000;
    interval = setInterval(async () => {
      if (!isPageVisible()) return;
      if (isConnected()) {
        try {
          const status = await getConnectionStatus();
          if (status.stats) {
            setStats(status.stats);
          }
        } catch {
          // ignore polling errors
        }
      } else {
        setStats(null);
      }
    }, pollMs);
  });

  onCleanup(() => {
    if (interval) clearInterval(interval);
  });

  return (
    <Show when={isConnected() && connectionInfo()}>
      {(_info) => {
        const info = connectionInfo()!;
        return (
          <div
            aria-live="polite"
            class="rounded-xl p-4 space-y-3 shadow-md"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* Server info */}
            <div class="flex justify-between items-center">
              <span class="text-xs" style="color: var(--color-text-dim)">
                Server
              </span>
              <span class="text-sm font-medium">
                {info.entry_server.city}, {info.entry_server.country_code}
              </span>
            </div>

            {/* IP */}
            <div class="flex justify-between items-center">
              <span class="text-xs" style="color: var(--color-text-dim)">
                VPN IP
              </span>
              <span
                class="text-sm font-mono"
                style="color: var(--color-accent)"
              >
                {info.assigned_ip}
              </span>
            </div>

            {/* Tunnely path */}
            <Show when={info.relay_path.length > 1}>
              <div class="flex justify-between items-center">
                <span class="text-xs" style="color: var(--color-text-dim)">
                  Hops
                </span>
                <span class="text-sm">{info.relay_path.length}</span>
              </div>
            </Show>

            {/* Stats */}
            <Show when={stats()}>
              {(_s) => {
                const s = stats()!;
                return (
                  <div
                    class="pt-3 grid grid-cols-3 gap-2 text-center"
                    style="border-top: 1px solid var(--color-border)"
                  >
                    <div>
                      <div
                        class="text-xs"
                        style="color: var(--color-text-dim)"
                      >
                        Upload
                      </div>
                      <div class="text-sm font-medium">
                        {formatBytes(s.bytes_tx)}
                      </div>
                    </div>
                    <div>
                      <div
                        class="text-xs"
                        style="color: var(--color-text-dim)"
                      >
                        Download
                      </div>
                      <div class="text-sm font-medium">
                        {formatBytes(s.bytes_rx)}
                      </div>
                    </div>
                    <div>
                      <div
                        class="text-xs"
                        style="color: var(--color-text-dim)"
                      >
                        Duration
                      </div>
                      <div class="text-sm font-medium">
                        {formatDuration(s.duration_secs)}
                      </div>
                    </div>
                  </div>
                );
              }}
            </Show>
          </div>
        );
      }}
    </Show>
  );
}
