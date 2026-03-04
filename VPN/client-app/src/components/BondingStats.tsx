import { Show, For, createSignal } from "solid-js";
import type { ChannelStatus } from "../lib/types";
import { toggleChannelEnabled } from "../lib/tauri";

interface Props {
  channels: ChannelStatus[];
}

export default function BondingStats(props: Props) {
  const handleToggle = async (id: number, currentEnabled: boolean) => {
    await toggleChannelEnabled(id, !currentEnabled);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "WiFi": return "📶";
      case "Ethernet": return "🔌";
      case "Cellular": return "📱";
      default: return "🌐";
    }
  };

  const stateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "active": return "#3b82f6";
      case "degraded": return "#f59e0b";
      case "failed": return "#ef4444";
      case "initializing": return "#8b5cf6";
      case "disabled": return "rgba(255,255,255,0.3)";
      default: return "rgba(255,255,255,0.5)";
    }
  };

  return (
    <>
      <div class="bonding-stats">
        <Show when={props.channels.length > 0} fallback={<div class="bonding-stats-empty">Bonding Disabled</div>}>
          <div class="bonding-stats-header">Network Interfaces</div>
          <div class="bonding-stats-channels">
            <For each={props.channels}>
              {(channel) => (
                <div class="bonding-channel" classList={{ "channel-disabled": !channel.enabled }}>
                  <div class="channel-left">
                    <div class="channel-row">
                      <span class="channel-icon">{typeIcon(channel.interface_type)}</span>
                      <span class="channel-name">{channel.name}</span>
                      <span class="channel-state" style={{ color: stateColor(channel.state) }}>
                        {channel.state}
                      </span>
                    </div>
                    <div class="channel-metrics">
                      <span class="metric">{channel.rtt_ms}ms</span>
                      <span class="metric-sep">·</span>
                      <span class="metric">{channel.throughput_kbps} kbps</span>
                      <span class="metric-sep">·</span>
                      <span class="metric">{channel.loss_pct.toFixed(1)}% loss</span>
                    </div>
                  </div>
                  <button
                    class="channel-toggle"
                    role="switch"
                    aria-checked={channel.enabled}
                    aria-label={channel.enabled ? `Disable ${channel.name} interface` : `Enable ${channel.name} interface`}
                    classList={{ "toggle-on": channel.enabled, "toggle-off": !channel.enabled }}
                    onClick={() => handleToggle(channel.id, channel.enabled)}
                    title={channel.enabled ? "Disable interface" : "Enable interface"}
                  >
                    <div class="toggle-knob" />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <style>{`
        .bonding-stats {
          display: flex;
          flex-direction: column;
          padding: 16px 20px;
          background: rgba(18,18,24,0.6);
          border: 1px solid var(--color-surface);
          border-radius: 14px;
          backdrop-filter: blur(12px);
          overflow-y: auto;
        }
        .bonding-stats-header {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.4);
          margin-bottom: 12px;
        }
        .bonding-stats-empty {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          font-weight: 500;
          font-style: italic;
          margin: auto;
        }
        .bonding-stats-channels {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        .bonding-channel {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--color-surface);
          transition: opacity 0.2s;
        }
        .bonding-channel.channel-disabled {
          opacity: 0.45;
        }
        .channel-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .channel-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .channel-icon {
          font-size: 14px;
        }
        .channel-name {
          font-size: 13px;
          font-weight: 600;
          color: #e4e4ed;
        }
        .channel-state {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .channel-metrics {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-left: 26px;
        }
        .metric {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
        }
        .metric-sep {
          color: rgba(255,255,255,0.2);
          font-size: 11px;
        }
        .channel-toggle {
          width: 36px;
          height: 20px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle-on {
          background: #3b82f6;
        }
        .toggle-off {
          background: rgba(255,255,255,0.15);
        }
        .toggle-knob {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 2px;
          transition: left 0.2s;
        }
        .toggle-on .toggle-knob {
          left: 18px;
        }
        .toggle-off .toggle-knob {
          left: 2px;
        }
      `}</style>
    </>
  );
}
