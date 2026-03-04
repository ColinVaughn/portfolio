export interface UserProfile {
  id: string;
  email: string;
}

export interface RelayServer {
  id: string;
  hostname: string;
  region: string;
  city: string;
  country_code: string;
  public_ip: string;
  wireguard_port: number;
  quic_port: number;
  current_clients: number;
  max_clients: number;
  status: string;
  latitude: number;
  longitude: number;
}

export interface ServerSummary {
  id: string;
  hostname: string;
  city: string;
  region: string;
  country_code: string;
}

export interface ConnectionInfo {
  session_id: string;
  assigned_ip: string;
  server_public_key: string;
  endpoint: string;
  entry_server: ServerSummary;
  exit_server: ServerSummary;
  relay_path: string[];
  dns: string[];
}

export interface ConnectionStats {
  bytes_tx: number;
  bytes_rx: number;
  duration_secs: number;
  connected_since: string | null;
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "reconnecting"
  | { error: { message: string } };

export interface ConnectionStatus {
  state: ConnectionState;
  info: ConnectionInfo | null;
  stats: ConnectionStats | null;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  city: string;
  country_code: string;
}

export interface ServerLatency {
  server_id: string;
  latency_ms: number;
}

export interface RecentConnection {
  server_id: string;
  city: string;
  country_code: string;
  connected_at: string;
}

export interface AppPreferences {
  auto_connect_on_launch: boolean;
  launch_on_startup: boolean;
  kill_switch_enabled: boolean;
  notifications_enabled: boolean;
  custom_dns: string | null;
  minimize_to_tray_on_close: boolean;
  bonding_mode: string;
  adblock_enabled: boolean;
  adblock_filter_level: string;
  theme: string;
}

export interface ChannelStatus {
  id: number;
  name: string;
  interface_type: string;
  state: string;
  rtt_ms: number;
  throughput_kbps: number;
  loss_pct: number;
  enabled: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  max_devices: number;
  bandwidth_limit_gb: number | null;
  can_bond: boolean;
  server_access: string;
  can_adblock_client: boolean;
  can_adblock_cosmetic: boolean;
  can_adblock_custom: boolean;
}

export interface Subscription {
  id: string;
  plan: Plan;
  status: string;
  billing_interval: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface AdblockStatus {
  enabled: boolean;
  ca_installed: boolean;
  ca_cert_path: string;
}

export interface BlockedEntry {
  url: string;
  source_url: string;
  request_type: string;
  filter_rule: string | null;
  timestamp: string;
}

export interface AdblockStatsSnapshot {
  requests_total: number;
  requests_blocked: number;
  bytes_saved: number;
  block_rate_percent: number;
  recent_blocked: BlockedEntry[];
  debug_logging_enabled: boolean;
}

export interface UpdateInfo {
  update_available: boolean;
  latest_version: string;
  download_url: string;
  release_notes: string;
  file_name: string;
  file_size: number;
}

export interface UpdateProgress {
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
}

