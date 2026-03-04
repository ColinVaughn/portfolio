import {
  connectionState,
  isConnected,
  isConnecting,
} from "../lib/stores";
import { connect, disconnect } from "../lib/tauri";
import { createSignal } from "solid-js";

interface Props {
  selectedServerId: string | null;
  locationName?: string;
  locationSub?: string;
}

export default function ConnectButton(props: Props) {
  const [error, setError] = createSignal("");

  const handleClick = async () => {
    setError("");

    try {
      if (isConnected()) {
        await disconnect();
      } else if (!isConnecting()) {
        await connect(props.selectedServerId ?? undefined);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const buttonColor = () => {
    if (isConnected()) return "var(--color-success)";
    if (isConnecting()) return "var(--color-warning)";
    const state = connectionState();
    if (typeof state === "object" && "error" in state) return "var(--color-danger)";
    return "var(--color-text-dim)";
  };

  const statusText = () => {
    const state = connectionState();
    if (state === "connected") return "Connected";
    if (state === "connecting") return "Connecting...";
    if (state === "disconnecting") return "Disconnecting...";
    if (state === "reconnecting") return "Reconnecting...";
    if (typeof state === "object" && "error" in state) return "Error";
    return "Disconnected";
  };

  return (
    <div class="relative flex flex-col items-center gap-2 md:gap-4 w-full md:w-auto">
      {/* Main toggle button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={connectionState() === "disconnecting"}
        aria-label={isConnected() ? "Disconnect from VPN" : "Connect to VPN"}
        aria-pressed={isConnected()}
        aria-busy={isConnecting() || connectionState() === "disconnecting"}
        class="relative flex flex-row md:flex-col items-center justify-start md:justify-center px-6 md:px-0 w-full h-[72px] md:w-32 md:h-32 lg:w-40 lg:h-40 rounded-none md:rounded-full transition-all duration-300 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-4 focus-visible:ring-offset-bg focus-visible:ring-accent backdrop-blur-xl group md:hover:bg-surface md:active:bg-surface-hover md:hover:scale-105 md:active:scale-95 shrink-0"
        style={{
          background: "var(--color-surface)",
          border: `1px solid var(--color-border)`,
          "box-shadow": `0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 0 40px ${buttonColor()}25, 0 0 60px ${buttonColor()}40`,
        }}
      >
        <div class="flex items-center justify-center shrink-0 w-10 h-10 md:w-full md:h-auto">
          {/* Power icon */}
          <svg
            class="relative z-10 w-6 h-6 md:w-10 md:h-10 lg:w-12 lg:h-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={buttonColor()}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>

          {/* Pulsing animation when connecting */}
          {isConnecting() && (
            <div
              class="absolute inset-0 rounded-none md:rounded-full animate-ping"
              style={{
                "box-shadow": `0 0 40px ${buttonColor()}`,
                opacity: 0.5,
              }}
            />
          )}
        </div>

        {/* Combined Location Info (Mobile Only) */}
        <div class="md:hidden flex flex-col items-start justify-center ml-4 flex-1 min-w-0 text-left">
          <span class="text-[10px] font-medium text-dim uppercase tracking-wider mb-0.5" style={{ color: buttonColor() }}>
            {statusText()}
          </span>
          <span class="text-sm font-semibold truncate text-text w-full">
            {props.locationName || "Auto (Best Server)"}
          </span>
        </div>
      </button>

      {/* Status label with live region for screen readers (Desktop Only) */}
      <span
        aria-live="polite"
        aria-atomic="true"
        class="hidden md:block text-sm font-medium"
        style={{ color: buttonColor() }}
      >
        {statusText()}
      </span>

      {/* Error message Popup */}
      {error() && (
        <div 
          role="alert" 
          class="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-[calc(100vw-32px)] max-w-[340px] md:top-[calc(100%+8px)] md:bottom-auto z-50 rounded-xl shadow-2xl p-4 flex flex-col gap-2 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 md:slide-in-from-top-2"
          style={{ 
            background: "var(--color-surface)",
            border: "1px solid var(--color-danger)",
            "box-shadow": "0 20px 40px rgba(0,0,0,0.2), inset 0 0 0 1px var(--color-border)"
          }}
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2 mt-0.5">
              <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span class="text-xs font-bold uppercase tracking-wider text-red-400">Connection Error</span>
            </div>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setError(""); }}
              class="text-text-dim hover:text-text transition-colors p-1.5 -mr-1.5 -mt-1.5 rounded-lg hover:bg-surface-hover shrink-0 select-none z-50 pointer-events-auto cursor-pointer"
              aria-label="Close error"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p class="text-sm font-medium text-text-dim text-left whitespace-normal break-words leading-relaxed pl-6">
            {error()}
          </p>
        </div>
      )}
    </div>
  );
}
