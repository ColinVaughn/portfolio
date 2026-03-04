import { invoke } from "@tauri-apps/api/core";
import type {
  UserProfile,
  RelayServer,
  ConnectionInfo,
  ConnectionStatus,
  UserLocation,
  ServerLatency,
  RecentConnection,
  AppPreferences,
  ChannelStatus,
  Subscription,
  AdblockStatus,
  AdblockStatsSnapshot,
  BlockedEntry,
  UpdateInfo,
} from "./types";

// ─── Auth ───

export async function login(
  email: string,
  password: string
): Promise<UserProfile> {
  return invoke("login", { email, password });
}

export async function signup(
  email: string,
  password: string
): Promise<UserProfile> {
  return invoke("signup", { email, password });
}

export async function logout(): Promise<void> {
  return invoke("logout");
}

export async function getAuthState(): Promise<UserProfile | null> {
  return invoke("get_auth_state");
}

export async function startOAuthFlow(provider: string): Promise<void> {
  return invoke("start_oauth_flow", { provider });
}

export async function finishOAuthFlow(authCode: string): Promise<UserProfile> {
  return invoke("finish_oauth_flow", { authCode });
}

// ─── Subscription ───

export async function getSubscription(): Promise<Subscription> {
  return invoke("get_subscription");
}

// ─── Servers ───

export async function fetchServers(): Promise<RelayServer[]> {
  return invoke("fetch_servers");
}

export async function getRecommendedServer(): Promise<RelayServer | null> {
  return invoke("get_recommended_server");
}

// ─── Connection ───

export async function connect(
  entryServerId?: string,
  exitServerId?: string
): Promise<ConnectionInfo> {
  return invoke("connect", {
    entry_server_id: entryServerId ?? null,
    exit_server_id: exitServerId ?? null,
  });
}

export async function disconnect(): Promise<void> {
  return invoke("disconnect");
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return invoke("get_connection_status");
}

// ─── Location ───

export async function getUserLocation(): Promise<UserLocation> {
  return invoke("get_user_location");
}

// ─── Latency ───

export async function pingServers(): Promise<ServerLatency[]> {
  return invoke("ping_servers");
}

// ─── Favorites ───

export async function loadFavorites(): Promise<string[]> {
  return invoke("load_favorites");
}

export async function saveFavorites(serverIds: string[]): Promise<void> {
  return invoke("save_favorites", { serverIds });
}

// ─── Recents ───

export async function loadRecents(): Promise<RecentConnection[]> {
  return invoke("load_recents");
}

export async function saveRecents(
  recents: RecentConnection[]
): Promise<void> {
  return invoke("save_recents", { recents });
}

// ─── Preferences ───

export async function loadPreferences(): Promise<AppPreferences> {
  return invoke("load_preferences");
}

export async function savePreferences(
  prefs: AppPreferences
): Promise<void> {
  return invoke("save_preferences", { prefs });
}

// ─── Bonding ───

export interface LocalInterface {
  name: string;
  interface_type: string;
  ip: string;
}

export async function getLocalInterfaces(): Promise<LocalInterface[]> {
  return invoke("get_local_interfaces");
}

export async function getBondingStatus(): Promise<ChannelStatus[]> {
  return invoke("get_bonding_status");
}

export async function setBondingMode(mode: string): Promise<void> {
  return invoke("set_bonding_mode", { mode });
}

export async function toggleChannelEnabled(channelId: number, enabled: boolean): Promise<void> {
  return invoke("toggle_channel_enabled", { channelId, enabled });
}

// ─── Adblock ───

export async function enableAdblock(): Promise<void> {
  return invoke("enable_adblock");
}

export async function disableAdblock(): Promise<void> {
  return invoke("disable_adblock");
}

export async function getAdblockStatus(): Promise<AdblockStatus> {
  return invoke("get_adblock_status");
}

export async function getAdblockStats(): Promise<AdblockStatsSnapshot> {
  return invoke("get_adblock_stats");
}

export async function installAdblockCa(): Promise<string> {
  return invoke("install_adblock_ca");
}

export async function getAdblockCaPath(): Promise<string> {
  return invoke("get_adblock_ca_path");
}

export async function updateAdblockFilters(): Promise<number> {
  return invoke("update_adblock_filters");
}

export async function getAdblockWhitelist(): Promise<string[]> {
  return invoke("get_adblock_whitelist");
}

export async function addAdblockWhitelist(domain: string): Promise<void> {
  return invoke("add_adblock_whitelist", { domain });
}

export async function removeAdblockWhitelist(domain: string): Promise<void> {
  return invoke("remove_adblock_whitelist", { domain });
}

export async function getAdblockFilterLevel(): Promise<string> {
  return invoke("get_adblock_filter_level");
}

export async function setAdblockFilterLevel(level: string): Promise<void> {
  return invoke("set_adblock_filter_level", { level });
}

export async function setAdblockDebugLogging(enabled: boolean): Promise<void> {
  return invoke("set_adblock_debug_logging", { enabled });
}

export async function getAdblockDebugLogging(): Promise<boolean> {
  return invoke("get_adblock_debug_logging");
}

export async function resetAdblockStats(): Promise<void> {
  return invoke("reset_adblock_stats");
}

// ─── Update ───

export async function checkForUpdates(): Promise<UpdateInfo> {
  return invoke("check_for_updates");
}

export async function downloadUpdate(downloadUrl: string, fileName: string): Promise<string> {
  return invoke("download_update", { downloadUrl, fileName });
}

export async function installUpdate(filePath: string): Promise<void> {
  return invoke("install_update", { filePath });
}

// ─── In-App Purchases (mobile only) ───

export async function getIapProducts(): Promise<any[]> {
  return invoke("get_iap_products");
}

export async function validateIapPurchase(receiptData: string, productId: string): Promise<any> {
  return invoke("validate_iap_purchase", { receiptData, productId });
}

export async function restoreIapPurchases(): Promise<string> {
  return invoke("restore_iap_purchases");
}
