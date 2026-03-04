use clap::Parser;
use serde::Deserialize;

/// VPN Relay Server Daemon
#[derive(Parser, Debug, Clone)]
#[command(name = "relay-core", about = "VPN Multi-Relay Server Daemon")]
pub struct CliArgs {
    /// Path to configuration file
    #[arg(short, long, default_value = "/etc/relay/config.toml")]
    pub config: String,

    /// Override server hostname
    #[arg(long, env = "RELAY_HOSTNAME")]
    pub hostname: Option<String>,

    /// Override region
    #[arg(long, env = "RELAY_REGION")]
    pub region: Option<String>,
}

/// Full relay server configuration
#[derive(Debug, Clone, Deserialize)]
pub struct RelayConfig {
    pub server: ServerConfig,
    pub supabase: SupabaseConfig,
    pub wireguard: WireGuardConfig,
    pub mesh: MeshConfig,
    pub health: HealthConfig,
    pub api: ApiConfig,
    pub quic: QuicConfig,
    pub bonding: BondingConfig,
    pub dns_filter: DnsFilterConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub hostname: String,
    pub region: String,
    pub city: String,
    pub country_code: String,
    pub public_ip: String,
    pub latitude: f64,
    pub longitude: f64,
    pub max_clients: i32,
    pub version: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SupabaseConfig {
    pub url: String,
    pub service_role_key: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WireGuardConfig {
    /// Port for client-facing WireGuard interface
    pub client_port: u16,
    /// Port for inter-relay mesh WireGuard interface
    pub mesh_port: u16,
    /// Path to store WireGuard private keys
    pub key_dir: String,
    /// Subnet for client tunnel IPs (e.g., "10.0.0.0/16")
    pub client_subnet: String,
    /// Subnet for mesh tunnel IPs (e.g., "10.100.0.0/16")
    pub mesh_subnet: String,
    /// DNS servers for clients
    pub dns_servers: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MeshConfig {
    /// How often to probe peer latency (seconds)
    pub probe_interval_secs: u64,
    /// How often to refresh peer discovery (seconds)
    pub discovery_interval_secs: u64,
    /// Number of probes per peer per cycle
    pub probes_per_cycle: u32,
    /// Probe timeout (milliseconds)
    pub probe_timeout_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HealthConfig {
    /// How often to send heartbeat to Supabase (seconds)
    pub heartbeat_interval_secs: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApiConfig {
    /// Local API bind address
    pub bind_address: String,
    /// Local API port
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QuicConfig {
    /// Enable QUIC obfuscation layer
    pub enabled: bool,
    /// QUIC listen port (443 to mimic HTTPS/HTTP3)
    pub port: u16,
    /// Path to TLS certificate PEM file
    pub cert_path: String,
    /// Path to TLS private key PEM file
    pub key_path: String,
    /// Auto-generate self-signed cert if files don't exist
    pub auto_generate_cert: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BondingConfig {
    pub enabled: bool,
    pub port: u16,
    pub max_reorder_buffer: usize,
    pub max_reorder_wait_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DnsFilterConfig {
    /// Enable DNS-level ad/tracker blocking
    pub enabled: bool,
    /// Address the DNS proxy listens on
    pub listen_address: String,
    /// Port the DNS proxy listens on (nftables redirects port 53 here)
    pub listen_port: u16,
    /// Upstream resolvers for allowed queries
    pub upstream_resolvers: Vec<String>,
    /// Directory to store blocklist files
    pub blocklist_dir: String,
    /// URLs to download blocklists from
    pub blocklist_urls: Vec<String>,
    /// How often to check for blocklist updates (hours)
    pub update_interval_hours: u64,
    /// Block DNS-over-HTTPS (port 443 to known DoH providers)
    pub block_doh: bool,
    /// Block DNS-over-TLS (port 853)
    pub block_dot: bool,
    /// Known DoH provider IPs to block via nftables
    pub doh_provider_ips: Vec<String>,
}

impl Default for RelayConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                hostname: "relay-01".into(),
                region: "us-east".into(),
                city: "Atlanta".into(),
                country_code: "US".into(),
                public_ip: "0.0.0.0".into(),
                latitude: 33.749,
                longitude: -84.388,
                max_clients: 250,
                version: env!("CARGO_PKG_VERSION").into(),
            },
            supabase: SupabaseConfig {
                url: "http://localhost:54321".into(),
                service_role_key: "".into(),
            },
            wireguard: WireGuardConfig {
                client_port: 51820,
                mesh_port: 51821,
                key_dir: "/etc/relay/keys".into(),
                client_subnet: "10.0.0.0/16".into(),
                mesh_subnet: "10.100.0.0/16".into(),
                dns_servers: vec!["1.1.1.1".into(), "8.8.8.8".into()],
            },
            mesh: MeshConfig {
                probe_interval_secs: 15,
                discovery_interval_secs: 60,
                probes_per_cycle: 5,
                probe_timeout_ms: 2000,
            },
            health: HealthConfig {
                heartbeat_interval_secs: 15,
            },
            api: ApiConfig {
                bind_address: "0.0.0.0".into(),
                port: 8080,
            },
            quic: QuicConfig {
                enabled: false,
                port: 443,
                cert_path: "/etc/relay/tls/cert.pem".into(),
                key_path: "/etc/relay/tls/key.pem".into(),
                auto_generate_cert: true,
            },
            bonding: BondingConfig {
                enabled: false,
                port: 51830,
                max_reorder_buffer: 512,
                max_reorder_wait_ms: 50,
            },
            dns_filter: DnsFilterConfig {
                enabled: false,
                listen_address: "127.0.0.1".into(),
                listen_port: 5353,
                upstream_resolvers: vec!["1.1.1.1".into(), "8.8.8.8".into()],
                blocklist_dir: "/etc/relay/blocklists".into(),
                blocklist_urls: vec![
                    // Steven Black Hosts (unified hosts + fakenews + gambling + social)
                    "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts".into(),
                    // OISD Full  - comprehensive curated blocklist
                    "https://big.oisd.nl/domainswild".into(),
                    // Peter Lowe's List  - minimal, high-confidence
                    "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&mimetype=plaintext".into(),
                    // HaGeZi's Pro++ List  - aggressive coverage
                    "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/pro.plus.txt".into(),
                    // AdGuard DNS Filter  - ABP syntax (domain extraction)
                    "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt".into(),
                    // Phishing Army Extended
                    "https://phishing.army/download/phishing_army_blocklist_extended.txt".into(),
                    // CoinBlocker List  - cryptominer domains
                    "https://zerodot1.gitlab.io/CoinBlockerLists/hosts_browser".into(),
                ],
                update_interval_hours: 24,
                block_doh: true,
                block_dot: true,
                doh_provider_ips: vec![
                    // Cloudflare
                    "1.1.1.1".into(), "1.0.0.1".into(),
                    // Google
                    "8.8.8.8".into(), "8.8.4.4".into(),
                    // Quad9
                    "9.9.9.9".into(), "149.112.112.112".into(),
                    // OpenDNS
                    "208.67.222.222".into(), "208.67.220.220".into(),
                    // AdGuard DNS
                    "94.140.14.14".into(), "94.140.15.15".into(),
                    // CleanBrowsing
                    "185.228.168.168".into(), "185.228.169.168".into(),
                ],
            },
        }
    }
}

impl RelayConfig {
    /// Load config from environment variables with defaults
    pub fn from_env() -> Self {
        let mut config = Self::default();

        if let Ok(v) = std::env::var("RELAY_HOSTNAME") {
            config.server.hostname = v;
        }
        if let Ok(v) = std::env::var("RELAY_REGION") {
            config.server.region = v;
        }
        if let Ok(v) = std::env::var("RELAY_CITY") {
            config.server.city = v;
        }
        if let Ok(v) = std::env::var("RELAY_COUNTRY_CODE") {
            config.server.country_code = v;
        }
        if let Ok(v) = std::env::var("RELAY_PUBLIC_IP") {
            config.server.public_ip = v;
        }
        if let Ok(v) = std::env::var("RELAY_LATITUDE") {
            if let Ok(lat) = v.parse() {
                config.server.latitude = lat;
            }
        }
        if let Ok(v) = std::env::var("RELAY_LONGITUDE") {
            if let Ok(lng) = v.parse() {
                config.server.longitude = lng;
            }
        }
        if let Ok(v) = std::env::var("RELAY_MAX_CLIENTS") {
            if let Ok(n) = v.parse() {
                config.server.max_clients = n;
            }
        }
        if let Ok(v) = std::env::var("SUPABASE_URL") {
            config.supabase.url = v;
        }
        if let Ok(v) = std::env::var("SUPABASE_SERVICE_ROLE_KEY") {
            config.supabase.service_role_key = v;
        }
        if let Ok(v) = std::env::var("WG_CLIENT_PORT") {
            if let Ok(p) = v.parse() {
                config.wireguard.client_port = p;
            }
        }
        if let Ok(v) = std::env::var("WG_MESH_PORT") {
            if let Ok(p) = v.parse() {
                config.wireguard.mesh_port = p;
            }
        }
        if let Ok(v) = std::env::var("WG_KEY_DIR") {
            config.wireguard.key_dir = v;
        }
        if let Ok(v) = std::env::var("WG_CLIENT_SUBNET") {
            config.wireguard.client_subnet = v;
        }
        if let Ok(v) = std::env::var("WG_MESH_SUBNET") {
            config.wireguard.mesh_subnet = v;
        }
        if let Ok(v) = std::env::var("WG_DNS_SERVERS") {
            config.wireguard.dns_servers = v.split(',').map(|s| s.trim().to_string()).collect();
        }
        if let Ok(v) = std::env::var("API_PORT") {
            if let Ok(p) = v.parse() {
                config.api.port = p;
            }
        }
        if let Ok(v) = std::env::var("API_BIND_ADDRESS") {
            config.api.bind_address = v;
        }
        if let Ok(v) = std::env::var("MESH_PROBE_INTERVAL_SECS") {
            if let Ok(n) = v.parse() {
                config.mesh.probe_interval_secs = n;
            }
        }
        if let Ok(v) = std::env::var("MESH_DISCOVERY_INTERVAL_SECS") {
            if let Ok(n) = v.parse() {
                config.mesh.discovery_interval_secs = n;
            }
        }
        if let Ok(v) = std::env::var("MESH_PROBES_PER_CYCLE") {
            if let Ok(n) = v.parse() {
                config.mesh.probes_per_cycle = n;
            }
        }
        if let Ok(v) = std::env::var("MESH_PROBE_TIMEOUT_MS") {
            if let Ok(n) = v.parse() {
                config.mesh.probe_timeout_ms = n;
            }
        }
        if let Ok(v) = std::env::var("HEALTH_HEARTBEAT_INTERVAL_SECS") {
            if let Ok(n) = v.parse() {
                config.health.heartbeat_interval_secs = n;
            }
        }
        if let Ok(v) = std::env::var("QUIC_ENABLED") {
            config.quic.enabled = v == "true" || v == "1";
        }
        if let Ok(v) = std::env::var("QUIC_PORT") {
            if let Ok(p) = v.parse() {
                config.quic.port = p;
            }
        }
        if let Ok(v) = std::env::var("QUIC_CERT_PATH") {
            config.quic.cert_path = v;
        }
        if let Ok(v) = std::env::var("QUIC_KEY_PATH") {
            config.quic.key_path = v;
        }
        if let Ok(v) = std::env::var("BONDING_ENABLED") {
            config.bonding.enabled = v == "true" || v == "1";
        }
        if let Ok(v) = std::env::var("BONDING_PORT") {
            if let Ok(p) = v.parse() {
                config.bonding.port = p;
            }
        }

        // DNS Filter config
        if let Ok(v) = std::env::var("DNS_FILTER_ENABLED") {
            config.dns_filter.enabled = v == "true" || v == "1";
        }
        if let Ok(v) = std::env::var("DNS_FILTER_LISTEN_ADDRESS") {
            config.dns_filter.listen_address = v;
        }
        if let Ok(v) = std::env::var("DNS_FILTER_LISTEN_PORT") {
            if let Ok(p) = v.parse() {
                config.dns_filter.listen_port = p;
            }
        }
        if let Ok(v) = std::env::var("DNS_FILTER_UPSTREAM_RESOLVERS") {
            config.dns_filter.upstream_resolvers =
                v.split(',').map(|s| s.trim().to_string()).collect();
        }
        if let Ok(v) = std::env::var("DNS_FILTER_BLOCKLIST_DIR") {
            config.dns_filter.blocklist_dir = v;
        }
        if let Ok(v) = std::env::var("DNS_FILTER_BLOCKLIST_URLS") {
            config.dns_filter.blocklist_urls = v.split(',').map(|s| s.trim().to_string()).collect();
        }
        if let Ok(v) = std::env::var("DNS_FILTER_UPDATE_INTERVAL_HOURS") {
            if let Ok(n) = v.parse() {
                config.dns_filter.update_interval_hours = n;
            }
        }
        if let Ok(v) = std::env::var("DNS_FILTER_BLOCK_DOH") {
            config.dns_filter.block_doh = v == "true" || v == "1";
        }
        if let Ok(v) = std::env::var("DNS_FILTER_BLOCK_DOT") {
            config.dns_filter.block_dot = v == "true" || v == "1";
        }
        if let Ok(v) = std::env::var("DNS_FILTER_DOH_PROVIDER_IPS") {
            config.dns_filter.doh_provider_ips =
                v.split(',').map(|s| s.trim().to_string()).collect();
        }

        config
    }
}
