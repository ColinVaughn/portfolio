import { onMount, Show } from "solid-js";
import WorldMap from "../components/Map/WorldMap";
import ConnectButton from "../components/ConnectButton";
import StatusBar from "../components/StatusBar";
import NetworkStatus from "../components/NetworkStatus";
import LatencyChart from "../components/LatencyChart";
import NetworkStats from "../components/NetworkStats";
import BondingStats from "../components/BondingStats";
import { useNetworkMonitor } from "../lib/useNetworkMonitor";
import {
  servers,
  selectedServerId,
  setServers,
  setUserLocation,
  isConnected,
  preferences,
} from "../lib/stores";
import { fetchServers, getUserLocation } from "../lib/tauri";
import type { RelayServer } from "../lib/types";

export default function HomePage() {
  const net = useNetworkMonitor();

  onMount(async () => {
    // Fetch servers if not already loaded
    if (servers().length === 0) {
      try {
        const s = await fetchServers();
        setServers(s);
      } catch (err) {
        console.error("Failed to fetch servers:", err);
      }
    }

    // Get user location for map
    try {
      const loc = await getUserLocation();
      setUserLocation(loc);
    } catch (err) {
      console.error("Failed to get user location:", err);
    }
  });

  const selectedServer = (): RelayServer | null => {
    const id = selectedServerId();
    if (!id) return null;
    return servers().find((s) => s.id === id) ?? null;
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Top section: Map + Controls */}
      <div class="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Map Background */}
        <div class="flex-1 md:flex-[1.5] relative flex items-center justify-center min-h-[200px]">
          <div class="absolute inset-0 w-full h-full flex items-center justify-center">
            <WorldMap />
          </div>
        </div>

        {/* Controls Panel */}
        <div 
          class="w-full md:w-[280px] lg:w-[380px] flex-none flex flex-row md:flex-col items-center justify-between md:justify-center py-4 px-4 md:p-6 lg:p-8 bg-surface/50 border-t md:border-t-0 md:border-l z-10 gap-4 md:gap-8"
          style={{ "border-color": "var(--color-border)" }}
        >
          {/* Combined Connect & Location Panel */}
          <div
            class="flex md:flex-col gap-0 md:gap-6 lg:gap-8 bg-transparent w-full md:w-auto"
          >
            {/* The Connect Button */}
            <div class="w-full flex justify-center">
              <ConnectButton 
                selectedServerId={selectedServerId()} 
                locationName={selectedServer() ? `${selectedServer()!.city}, ${selectedServer()!.country_code}` : "Auto (Best Server)"}
              />
            </div>

            {/* Selected Server Info (Desktop Only) */}
            <div
              class="hidden md:flex flex-1 items-center gap-3 md:px-4 lg:px-5 md:py-3 lg:py-3 md:rounded-2xl md:backdrop-blur-md md:transition-all md:duration-300 md:shadow-sm md:w-full md:max-w-[280px]"
              style={{
                "background": "undefined", // We will let a style tag handle the desktop desktop background
              }}
            >
              <div 
                class="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(59, 130, 246, 0.1)", color: "var(--color-accent)" }}
              >
                <svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div class="flex flex-col overflow-hidden min-w-0">
                <span class="text-[10px] md:text-xs font-medium text-dim uppercase tracking-wider mb-0.5">Location</span>
                <span class="text-sm md:text-sm font-semibold truncate text-text">
                  {selectedServer()
                    ? `${selectedServer()!.city}, ${selectedServer()!.country_code}`
                    : "Auto (Best Server)"}
                </span>
              </div>
            </div>

            {/* Bonding Stats (if enabled & connected) */}
            <Show when={isConnected() && preferences().bonding_mode && preferences().bonding_mode !== "None"}>
              <div class="hidden md:flex flex-1 w-full mt-4">
                <BondingStats channels={net.bondingChannels()} />
              </div>
            </Show>

          </div>
        </div>
      </div>

      <style>{`
        /* Add desktop styling for the server info card that shouldn't apply on mobile */
        @media (min-width: 768px) {
          .md\\:bg-solid-glass {
            background: var(--color-surface) !important;
            border: 1px solid var(--color-border) !important;
          }
        }
      `}</style>

      {/* Bottom: Full-width horizontal network bar */}
      <div class="home-net-bar">
        <div class="home-net-bar-item home-net-bar-status">
          <NetworkStatus quality={net.networkQuality()} />
        </div>
        <div class="home-net-bar-item home-net-bar-chart">
          <LatencyChart history={net.latencyHistory()} latencyMs={net.latencyMs()} />
        </div>
        <div class="home-net-bar-item home-net-bar-speeds">
          <NetworkStats downSpeed={net.downSpeed()} upSpeed={net.upSpeed()} />
        </div>
      </div>

      <style>{`
        .home-net-bar {
          display: flex;
          align-items: stretch;
          width: 100%;
          background: var(--color-surface);
          border-top: 1px solid var(--color-surface-hover);
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .home-net-bar-item {
          padding: 14px 20px;
          display: flex;
          align-items: center;
          box-sizing: border-box;
        }
        /* Status and speeds share equal side space, chart takes the rest */
        .home-net-bar-status {
          flex: 0 0 22%;
          border-right: 1px solid var(--color-surface);
        }
        .home-net-bar-chart {
          flex: 1 1 0%;
          min-width: 0;
        }
        .home-net-bar-speeds {
          flex: 0 0 22%;
          border-left: 1px solid var(--color-surface);
        }
        /* Make children fill their containers */
        .home-net-bar-item > * {
          width: 100%;
        }
        /* Override component card backgrounds to be transparent in the bar */
        .home-net-bar .net-status,
        .home-net-bar .net-chart,
        .home-net-bar .net-stats {
          background: transparent !important;
          border: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          backdrop-filter: none !important;
        }
        /* Chart fills the available width dynamically */
        .home-net-bar .net-chart-svg {
          height: 48px;
          width: 100%;
        }
        @media (max-width: 700px) {
          .home-net-bar {
            flex-direction: column;
          }
          .home-net-bar-status,
          .home-net-bar-speeds {
            flex: 0 0 auto;
            border-right: none;
            border-left: none;
            border-bottom: 1px solid var(--color-surface);
          }
        }
      `}</style>
    </div>
  );
}
