import { createSignal } from "solid-js";
import type {
  UserProfile,
  RelayServer,
  ConnectionState,
  ConnectionInfo,
  ConnectionStats,
  UserLocation,
  ServerLatency,
  RecentConnection,
  AppPreferences,
  Subscription,
  Plan,
  AdblockStatus,
  AdblockStatsSnapshot,
  UpdateInfo,
  UpdateProgress,
} from "./types";

// ─── Auth Store ───
export const [user, setUser] = createSignal<UserProfile | null>(null);
export const [authLoading, setAuthLoading] = createSignal(true);

// ─── Subscription Store ───
export const [subscription, setSubscription] = createSignal<Subscription | null>(null);

// ─── Server Store ───
export const [servers, setServers] = createSignal<RelayServer[]>([]);
export const [selectedServerId, setSelectedServerId] = createSignal<
  string | null
>(null);

// ─── Connection Store ───
export const [connectionState, setConnectionState] =
  createSignal<ConnectionState>("disconnected");
export const [connectionInfo, setConnectionInfo] =
  createSignal<ConnectionInfo | null>(null);
export const [connectionStats, setConnectionStats] =
  createSignal<ConnectionStats | null>(null);

// ─── Location + Latency Store ───
export const [userLocation, setUserLocation] =
  createSignal<UserLocation | null>(null);
export const [serverLatencies, setServerLatencies] = createSignal<
  ServerLatency[]
>([]);

// ─── Favorites + Recents Store ───
export const [favorites, setFavorites] = createSignal<string[]>([]);
export const [recentConnections, setRecentConnections] = createSignal<
  RecentConnection[]
>([]);

// ─── Preferences Store ───
export const [preferences, setPreferences] = createSignal<AppPreferences>({
  auto_connect_on_launch: false,
  launch_on_startup: false,
  kill_switch_enabled: false,
  notifications_enabled: true,
  custom_dns: null,
  minimize_to_tray_on_close: true,
  bonding_mode: "Speed",
  adblock_enabled: false,
  adblock_filter_level: "Standard",
  theme: "system",
});

// ─── Adblock Store ───
export const [adblockStatus, setAdblockStatus] = createSignal<AdblockStatus | null>(null);
export const [adblockStats, setAdblockStats] = createSignal<AdblockStatsSnapshot | null>(null);
export const [adblockWhitelist, setAdblockWhitelist] = createSignal<string[]>([]);

// ─── Update Store ───
export const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);
export const [updateDownloading, setUpdateDownloading] = createSignal(false);
export const [updateProgress, setUpdateProgress] = createSignal<UpdateProgress | null>(null);
export const [updateDownloadedPath, setUpdateDownloadedPath] = createSignal<string | null>(null);
export const [updateDismissed, setUpdateDismissed] = createSignal(false);

// ─── Subscription Helpers ───
export function currentPlan(): Plan | null {
  return subscription()?.plan ?? null;
}

export function canBond(): boolean {
  return subscription()?.plan?.can_bond ?? false;
}

export function isPremium(): boolean {
  const slug = subscription()?.plan?.slug;
  return slug === "pro" || slug === "enterprise";
}

export function isFreePlan(): boolean {
  const slug = subscription()?.plan?.slug;
  return !slug || slug === "free";
}

export function planDisplayName(): string {
  return subscription()?.plan?.name ?? "Free";
}

export function canAdblockClient(): boolean {
  return subscription()?.plan?.can_adblock_client ?? false;
}

export function canAdblockCosmetic(): boolean {
  return subscription()?.plan?.can_adblock_cosmetic ?? false;
}

export function canAdblockCustom(): boolean {
  return subscription()?.plan?.can_adblock_custom ?? false;
}

// ─── Connection Helpers ───
export function isConnected(): boolean {
  return connectionState() === "connected";
}

export function isConnecting(): boolean {
  const state = connectionState();
  return state === "connecting" || state === "reconnecting";
}

export function getErrorMessage(): string | null {
  const state = connectionState();
  if (typeof state === "object" && "error" in state) {
    return state.error.message;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
