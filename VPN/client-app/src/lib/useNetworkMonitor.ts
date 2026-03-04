import { createSignal, onMount, onCleanup } from "solid-js";
import { getBondingStatus } from "./tauri";
import type { ChannelStatus } from "./types";
import { isConnected } from "./stores";
import { isPageVisible, isMobilePlatform } from "./usePageVisibility";

export type NetworkQuality = "good" | "degraded" | "offline";

const MOBILE_POLL_INTERVAL = 30_000; // 30s on mobile
const DESKTOP_POLL_INTERVAL = 8_000; // 8s on desktop

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)}B/s`;
  const kbps = bytesPerSec / 1024;
  if (kbps < 1024) return `${kbps.toFixed(1)}KB/s`;
  const mbps = kbps / 1024;
  return `${mbps.toFixed(1)}MB/s`;
}

/** Use navigator.connection API (available on Android) for lightweight speed estimates. */
function measureFromConnectionApi(): { down: string; up: string; latency: string; quality: NetworkQuality } | null {
  const conn = (navigator as any).connection;
  if (!conn?.downlink) return null;
  return {
    down: `${conn.downlink.toFixed(1)}Mb/s`,
    up: `${(conn.downlink * 0.3).toFixed(1)}Mb/s`,
    latency: `${conn.rtt || "--"}ms`,
    quality: conn.rtt > 200 ? "degraded" : "good",
  };
}

/** Reactive network monitoring hook. Call once per component tree that needs it. */
export function useNetworkMonitor(pollIntervalMs?: number) {
  const mobile = isMobilePlatform();
  const effectiveInterval = pollIntervalMs ?? (mobile ? MOBILE_POLL_INTERVAL : DESKTOP_POLL_INTERVAL);

  const [latencyHistory, setLatencyHistory] = createSignal<number[]>(Array(32).fill(0));
  const [downSpeed, setDownSpeed] = createSignal("--");
  const [upSpeed, setUpSpeed] = createSignal("--");
  const [latencyMs, setLatencyMs] = createSignal("--");
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);
  const [networkQuality, setNetworkQuality] = createSignal<NetworkQuality>("good");
  const [bondingChannels, setBondingChannels] = createSignal<ChannelStatus[]>([]);

  let latencyRaw: number[] = Array(32).fill(0);

  const pushLatency = (ms: number) => {
    latencyRaw = [...latencyRaw.slice(1), ms];
    setLatencyHistory([...latencyRaw]);
  };

  const measureSpeed = async () => {
    // Skip measurement when app is backgrounded
    if (!isPageVisible()) return;

    if (!navigator.onLine) {
      setIsOnline(false);
      setNetworkQuality("offline");
      setLatencyMs("--");
      setDownSpeed("--");
      setUpSpeed("--");
      pushLatency(0);
      return;
    }
    setIsOnline(true);

    if (isConnected()) {
      try {
        const statuses = await getBondingStatus();
        setBondingChannels(statuses);
      } catch (e) {
        // ignore
      }
    } else {
      setBondingChannels([]);
    }

    // On mobile, use navigator.connection API or a lightweight ping fallback
    if (mobile) {
      const connData = measureFromConnectionApi();
      if (connData) {
        setDownSpeed(connData.down);
        setUpSpeed(connData.up);
        setLatencyMs(connData.latency);
        setNetworkQuality(connData.quality);
        const rtt = (navigator as any).connection?.rtt;
        pushLatency(rtt || 0);
      } else {
        // Fallback: lightweight ping when navigator.connection is unavailable
        try {
          const pingStart = performance.now();
          await fetch("https://www.google.com/generate_204", { mode: "no-cors", cache: "no-store" });
          const pingMs = performance.now() - pingStart;
          setLatencyMs(`${Math.round(pingMs)}ms`);
          pushLatency(pingMs);
          if (pingMs < 100) setNetworkQuality("good");
          else if (pingMs < 300) setNetworkQuality("degraded");
          else setNetworkQuality("degraded");
          // No download/upload test on mobile  - just show latency
          setDownSpeed("--");
          setUpSpeed("--");
        } catch {
          pushLatency(0);
          setNetworkQuality("offline");
          setLatencyMs("--");
          setDownSpeed("--");
          setUpSpeed("--");
        }
      }
      return;
    }

    try {
      // Latency ping
      const pingStart = performance.now();
      await fetch("https://www.google.com/generate_204", { mode: "no-cors", cache: "no-store" });
      const pingMs = performance.now() - pingStart;
      setLatencyMs(`${Math.round(pingMs)}ms`);
      pushLatency(pingMs);

      if (pingMs < 100) setNetworkQuality("good");
      else if (pingMs < 250) setNetworkQuality("degraded");
      else setNetworkQuality("degraded");

      // Download test (100KB)
      const dlStart = performance.now();
      const dlResp = await fetch("https://httpbin.org/bytes/102400", { cache: "no-store" });
      const dlBlob = await dlResp.blob();
      const dlTime = (performance.now() - dlStart) / 1000;
      setDownSpeed(formatSpeed(dlBlob.size / dlTime));

      // Upload test (32KB)
      const uploadPayload = new Uint8Array(32768);
      const ulStart = performance.now();
      await fetch("https://httpbin.org/post", { method: "POST", body: uploadPayload, cache: "no-store" });
      const ulTime = (performance.now() - ulStart) / 1000;
      setUpSpeed(formatSpeed(uploadPayload.byteLength / ulTime));
    } catch {
      pushLatency(0);
      const connData = measureFromConnectionApi();
      if (connData) {
        setDownSpeed(connData.down);
        setUpSpeed(connData.up);
        setLatencyMs(connData.latency);
        setNetworkQuality(connData.quality);
      } else {
        setNetworkQuality("offline");
        setDownSpeed("--");
        setUpSpeed("--");
      }
    }
  };

  let speedInterval: ReturnType<typeof setInterval>;
  const handleOnline = () => { setIsOnline(true); measureSpeed(); };
  const handleOffline = () => {
    setIsOnline(false);
    setNetworkQuality("offline");
    setDownSpeed("--");
    setUpSpeed("--");
    setLatencyMs("--");
    pushLatency(0);
  };

  onMount(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    measureSpeed();
    speedInterval = setInterval(measureSpeed, effectiveInterval);
  });
  onCleanup(() => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    clearInterval(speedInterval);
  });

  return { latencyHistory, downSpeed, upSpeed, latencyMs, isOnline, networkQuality, bondingChannels };
}

export { formatSpeed };
