import { createSignal, createMemo, For, Show, onMount } from "solid-js";
import {
  servers,
  selectedServerId,
  setSelectedServerId,
  setServers,
  favorites,
  setFavorites,
  recentConnections,
  serverLatencies,
  isConnected,
} from "../lib/stores";
import { fetchServers, saveFavorites, loadFavorites } from "../lib/tauri";
import type { RelayServer } from "../lib/types";

export default function ServersPage() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedSections, setExpandedSections] = createSignal<
    Record<string, boolean>
  >({ favorites: true, recent: true, all: true });

  onMount(async () => {
    if (servers().length === 0) {
      try {
        const s = await fetchServers();
        setServers(s);
      } catch (err) {
        console.error("Failed to fetch servers:", err);
      }
    }
    try {
      const favs = await loadFavorites();
      setFavorites(favs);
    } catch {
      // no saved favorites yet
    }
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter servers by search query
  const filteredServers = createMemo(() => {
    const q = searchQuery().toLowerCase().trim();
    if (!q) return servers();
    return servers().filter(
      (s) =>
        s.city.toLowerCase().includes(q) ||
        s.country_code.toLowerCase().includes(q) ||
        s.hostname.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q)
    );
  });

  // Favorite servers
  const favoriteServers = createMemo(() => {
    const favIds = favorites();
    return filteredServers().filter((s) => favIds.includes(s.id));
  });

  // Recent connections mapped to servers
  const recentServers = createMemo(() => {
    const recents = recentConnections();
    return recents
      .map((r) => servers().find((s) => s.id === r.server_id))
      .filter(Boolean) as RelayServer[];
  });

  // Group remaining servers by region
  const groupedServers = createMemo(() => {
    const groups: Record<string, RelayServer[]> = {};
    for (const server of filteredServers()) {
      const region = server.region || "other";
      if (!groups[region]) groups[region] = [];
      groups[region].push(server);
    }
    return groups;
  });

  const isFavorite = (serverId: string) => favorites().includes(serverId);

  const toggleFavorite = async (serverId: string) => {
    const current = favorites();
    const updated = isFavorite(serverId)
      ? current.filter((id) => id !== serverId)
      : [...current, serverId];
    setFavorites(updated);
    try {
      await saveFavorites(updated);
    } catch (err) {
      console.error("Failed to save favorites:", err);
    }
  };

  const selectServer = (server: RelayServer) => {
    if (!isConnected()) {
      setSelectedServerId(server.id);
    }
  };

  const getLatency = (serverId: string): number | null => {
    const entry = serverLatencies().find((l) => l.server_id === serverId);
    return entry ? entry.latency_ms : null;
  };

  const loadPercent = (s: RelayServer) =>
    s.max_clients > 0
      ? Math.round((s.current_clients / s.max_clients) * 100)
      : 0;

  const loadColor = (pct: number) => {
    if (pct < 50) return "var(--color-success)";
    if (pct < 80) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const latencyColor = (ms: number) => {
    if (ms < 50) return "var(--color-success)";
    if (ms < 150) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const countryFlag = (code: string): string => {
    if (!code || code.length !== 2) return "\u{1F310}";
    const offset = 0x1f1e6;
    const a = code.charCodeAt(0) - 65 + offset;
    const b = code.charCodeAt(1) - 65 + offset;
    return String.fromCodePoint(a, b);
  };

  return (
    <div class="flex flex-col h-full">
      {/* Search bar */}
      <div class="px-6 pt-6 pb-4 md:pt-8 md:px-8">
        <div
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 focus-within:ring-2 focus-within:ring-accent/50 focus-within:bg-surface-hover"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            aria-label="Search servers"
            placeholder="Search servers..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="flex-1 bg-transparent text-sm outline-none"
            style="color: var(--color-text)"
          />
        </div>
      </div>

      {/* Server list */}
      <div class="flex-1 overflow-y-auto px-6 pb-8 md:px-8 space-y-6">
        {/* Favorites section */}
        <Show when={favoriteServers().length > 0}>
          <Section
            title="Favorites"
            icon="\u2605"
            expanded={expandedSections().favorites}
            onToggle={() => toggleSection("favorites")}
          >
            <For each={favoriteServers()}>
              {(server) => (
                <ServerRow
                  server={server}
                  selected={selectedServerId() === server.id}
                  favorite={true}
                  latency={getLatency(server.id)}
                  disabled={isConnected()}
                  onSelect={() => selectServer(server)}
                  onToggleFavorite={() => toggleFavorite(server.id)}
                  countryFlag={countryFlag}
                  loadPercent={loadPercent}
                  loadColor={loadColor}
                  latencyColor={latencyColor}
                />
              )}
            </For>
          </Section>
        </Show>

        {/* Recent section */}
        <Show when={recentServers().length > 0 && !searchQuery()}>
          <Section
            title="Recent"
            icon="\u{1F552}"
            expanded={expandedSections().recent}
            onToggle={() => toggleSection("recent")}
          >
            <For each={recentServers().slice(0, 5)}>
              {(server) => (
                <ServerRow
                  server={server}
                  selected={selectedServerId() === server.id}
                  favorite={isFavorite(server.id)}
                  latency={getLatency(server.id)}
                  disabled={isConnected()}
                  onSelect={() => selectServer(server)}
                  onToggleFavorite={() => toggleFavorite(server.id)}
                  countryFlag={countryFlag}
                  loadPercent={loadPercent}
                  loadColor={loadColor}
                  latencyColor={latencyColor}
                />
              )}
            </For>
          </Section>
        </Show>

        {/* All servers grouped by region */}
        <For each={Object.entries(groupedServers())}>
          {([region, regionServers]) => (
            <Section
              title={region}
              expanded={expandedSections()[region] ?? true}
              onToggle={() => toggleSection(region)}
            >
              <For each={regionServers}>
                {(server) => (
                  <ServerRow
                    server={server}
                    selected={selectedServerId() === server.id}
                    favorite={isFavorite(server.id)}
                    latency={getLatency(server.id)}
                    disabled={isConnected()}
                    onSelect={() => selectServer(server)}
                    onToggleFavorite={() => toggleFavorite(server.id)}
                    countryFlag={countryFlag}
                    loadPercent={loadPercent}
                    loadColor={loadColor}
                    latencyColor={latencyColor}
                  />
                )}
              </For>
            </Section>
          )}
        </For>

        <Show when={filteredServers().length === 0}>
          <p
            class="text-center text-sm py-8"
            style="color: var(--color-text-dim)"
          >
            {searchQuery() ? "No servers match your search" : "No servers available"}
          </p>
        </Show>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function Section(props: {
  title: string;
  icon?: string;
  expanded: boolean;
  onToggle: () => void;
  children: any;
}) {
  return (
    <div class="mb-4">
      <button
        onClick={props.onToggle}
        aria-expanded={props.expanded}
        class="flex items-center gap-3 w-full px-2 py-2 cursor-pointer group hover:bg-surface rounded-lg transition-colors mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span class="text-sm opacity-70 group-hover:opacity-100 transition-opacity" aria-hidden="true">
          {props.icon}
        </span>
        <span
          class="text-xs font-bold uppercase tracking-widest"
          style="color: var(--color-text-dim)"
        >
          {props.title}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          class="ml-auto opacity-50 group-hover:opacity-100"
          style={{
            transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <Show when={props.expanded}>
        <div 
          class="grid grid-cols-1 xl:grid-cols-2 gap-3 pl-1 pr-1"
          role="list"
          aria-label={`${props.title} servers`}
        >
            {props.children}
        </div>
      </Show>
    </div>
  );
}

function ServerRow(props: {
  server: RelayServer;
  selected: boolean;
  favorite: boolean;
  latency: number | null;
  disabled: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  countryFlag: (code: string) => string;
  loadPercent: (s: RelayServer) => number;
  loadColor: (pct: number) => string;
  latencyColor: (ms: number) => string;
}) {
  const load = () => props.loadPercent(props.server);

  return (
    <div
      role="listitem"
      class="flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden"
      style={{
        background: props.selected
          ? "var(--color-surface-hover)"
          : "var(--color-surface)",
        border: props.selected
          ? "1px solid var(--color-accent)"
          : "1px solid var(--color-border)",
        opacity: props.disabled && !props.selected ? "0.6" : "1",
      }}
    >
      <button
        onClick={props.onSelect}
        disabled={props.disabled}
        aria-pressed={props.selected}
        aria-label={`Select ${props.server.city} server`}
        class="flex items-center gap-4 flex-1 cursor-pointer disabled:cursor-not-allowed text-left w-full h-full absolute inset-0 pl-4 pr-24 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-xl"
      >
        <span class="text-2xl drop-shadow-sm" aria-hidden="true">{props.countryFlag(props.server.country_code)}</span>
        <div class="flex flex-col">
          <div class="text-[15px] font-semibold tracking-wide text-text">{props.server.city}</div>
          <div class="text-[11px] uppercase tracking-wider mt-0.5" style="color: var(--color-text-dim)">
            {props.server.hostname}
          </div>
        </div>
      </button>

      <div class="flex items-center gap-4 relative z-20 pointer-events-none ml-auto">
        {/* Latency */}
        <Show when={props.latency !== null}>
          <span
            class="text-[10px] font-mono"
            style={{ color: props.latencyColor(props.latency!) }}
          >
            {props.latency}ms
          </span>
        </Show>

        {/* Load */}
        <div class="flex items-center gap-1">
          <div
            class="w-1.5 h-1.5 rounded-full"
            style={{ background: props.loadColor(load()) }}
          />
          <span class="text-[10px]" style="color: var(--color-text-dim)">
            {load()}%
          </span>
        </div>

        {/* Favorite toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onToggleFavorite();
          }}
          aria-pressed={props.favorite}
          aria-label={props.favorite ? `Remove ${props.server.city} from favorites` : `Add ${props.server.city} to favorites`}
          class="w-8 h-8 rounded-full hover:bg-surface-hover flex items-center justify-center cursor-pointer pointer-events-auto transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{
            color: props.favorite
              ? "var(--color-warning)"
              : "var(--color-border)",
          }}
          title={props.favorite ? "Remove from favorites" : "Add to favorites"}
        >
          {props.favorite ? "\u2605" : "\u2606"}
        </button>
      </div>
    </div>
  );
}
