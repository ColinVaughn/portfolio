import { For, Show, createMemo } from "solid-js";
import { servers, selectedServerId, setSelectedServerId } from "../lib/stores";
import type { RelayServer } from "../lib/types";

interface Props {
  onClose: () => void;
}

export default function ServerPicker(props: Props) {
  // Group servers by region
  const groupedServers = createMemo(() => {
    const groups: Record<string, RelayServer[]> = {};
    for (const server of servers()) {
      const region = server.region || "other";
      if (!groups[region]) groups[region] = [];
      groups[region].push(server);
    }
    return groups;
  });

  const loadPercent = (s: RelayServer) => {
    if (s.max_clients <= 0) return 0;
    return Math.round((s.current_clients / s.max_clients) * 100);
  };

  const loadColor = (pct: number) => {
    if (pct < 50) return "var(--color-success)";
    if (pct < 80) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center justify-between p-4">
        <h2 class="text-lg font-semibold">Select Server</h2>
        <button
          onClick={props.onClose}
          aria-label="Close server picker"
          class="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
          style="background: var(--color-surface); color: var(--color-text-dim)"
        >
          &times;
        </button>
      </div>

      {/* Server list */}
      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <For each={Object.entries(groupedServers())}>
          {([region, regionServers]) => (
            <div>
              <h3
                class="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
                style="color: var(--color-text-dim)"
              >
                {region}
              </h3>
              <div class="space-y-1">
                <For each={regionServers}>
                  {(server) => {
                    const load = loadPercent(server);
                    const isSelected = () => selectedServerId() === server.id;

                    return (
                      <button
                        onClick={() => {
                          setSelectedServerId(server.id);
                          props.onClose();
                        }}
                        aria-pressed={isSelected()}
                        aria-label={`Select ${server.city} server`}
                        class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
                        style={{
                          background: isSelected()
                            ? "var(--color-surface-hover)"
                            : "transparent",
                          border: isSelected()
                            ? "1px solid var(--color-accent)"
                            : "1px solid transparent",
                        }}
                      >
                        <div class="flex items-center gap-3">
                          <span class="text-base">
                            {countryFlag(server.country_code)}
                          </span>
                          <div class="text-left">
                            <div class="text-sm font-medium">
                              {server.city}
                            </div>
                            <div
                              class="text-xs"
                              style="color: var(--color-text-dim)"
                            >
                              {server.hostname}
                            </div>
                          </div>
                        </div>

                        <div class="flex items-center gap-2">
                          <div
                            class="w-1.5 h-1.5 rounded-full"
                            style={{ background: loadColor(load) }}
                          />
                          <span
                            class="text-xs"
                            style="color: var(--color-text-dim)"
                          >
                            {load}%
                          </span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>

        <Show when={servers().length === 0}>
          <p
            class="text-center text-sm py-8"
            style="color: var(--color-text-dim)"
          >
            No servers available
          </p>
        </Show>
      </div>
    </div>
  );
}

/** Convert 2-letter country code to emoji flag */
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const offset = 0x1f1e6;
  const a = code.charCodeAt(0) - 65 + offset;
  const b = code.charCodeAt(1) - 65 + offset;
  return String.fromCodePoint(a, b);
}
