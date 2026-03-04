import type { NetworkQuality } from "../lib/useNetworkMonitor";

interface Props {
  quality: NetworkQuality;
}

const COLORS: Record<NetworkQuality, { bg: string; border: string; dot: string; glow: string; text: string; label: string }> = {
  good: {
    bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.12)",
    dot: "#10b981", glow: "0 0 8px rgba(16,185,129,0.6)", text: "#10b981", label: "OPERATIONAL",
  },
  degraded: {
    bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.12)",
    dot: "#f59e0b", glow: "0 0 8px rgba(245,158,11,0.6)", text: "#f59e0b", label: "DEGRADED",
  },
  offline: {
    bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.12)",
    dot: "#ef4444", glow: "0 0 8px rgba(239,68,68,0.6)", text: "#ef4444", label: "OFFLINE",
  },
};

export default function NetworkStatus(props: Props) {
  const c = () => COLORS[props.quality];

  return (
    <>
      <div
        class="net-status"
        style={{ background: c().bg, "border-color": c().border }}
      >
        <div
          class="net-status-dot"
          style={{ background: c().dot, "box-shadow": c().glow }}
        />
        <span class="net-status-label">SYSTEM STATUS:</span>
        <span class="net-status-value" style={{ color: c().text }}>
          {c().label}
        </span>
      </div>

      <style>{`
        .net-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: 1px solid;
          border-radius: 10px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 11px;
        }
        .net-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: net-pulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes net-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .net-status-label {
          color: var(--color-text-dim);
          font-weight: 600;
          letter-spacing: 1px;
        }
        .net-status-value {
          font-weight: 700;
          letter-spacing: 1px;
        }
      `}</style>
    </>
  );
}
