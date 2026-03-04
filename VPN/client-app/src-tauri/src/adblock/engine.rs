use adblock::lists::{FilterSet, ParseOptions};
use adblock::request::Request;
use adblock::Engine;
use anyhow::{Context, Result};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Wrapper around the Brave `adblock::Engine` for network-level ad blocking
/// and cosmetic filter retrieval.
pub struct AdblockEngine {
    /// The underlying Brave adblock engine
    engine: Arc<RwLock<Engine>>,
    /// Path to store filter list files
    lists_dir: PathBuf,
}

/// Result of checking a URL against the adblock engine
#[derive(Debug, Clone)]
pub struct BlockResult {
    /// Whether the request should be blocked
    pub matched: bool,
    /// Whether there's an exception that allows it
    pub has_exception: bool,
    pub filter: Option<String>,
}

/// Cosmetic filter result for a given domain
#[derive(Debug, Clone)]
pub struct CosmeticResult {
    /// CSS selectors to hide elements
    pub hide_selectors: Vec<String>,
    /// CSS style rules to inject
    pub style_selectors: Vec<(String, Vec<String>)>,
    /// JavaScript scriptlets to inject
    pub injected_script: String,
}

impl AdblockEngine {
    /// Create a new AdblockEngine with no rules loaded.
    pub fn new(lists_dir: PathBuf) -> Self {
        let engine = Engine::from_filter_set(FilterSet::new(true), true);
        Self {
            engine: Arc::new(RwLock::new(engine)),
            lists_dir,
        }
    }

    /// Load filter lists from all files in the lists directory.
    /// Parses both ABP syntax and network filter formats.
    pub async fn load_from_disk(&self) -> Result<usize> {
        let dir = &self.lists_dir;
        if !dir.exists() {
            tracing::warn!(dir = %dir.display(), "Filter lists directory does not exist");
            return Ok(0);
        }

        let mut all_rules = Vec::new();
        let mut entries = tokio::fs::read_dir(dir)
            .await
            .context("Failed to read filter lists directory")?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            match tokio::fs::read_to_string(&path).await {
                Ok(content) => {
                    let count = content.lines().count();
                    all_rules.push(content);
                    tracing::info!(
                        file = %path.display(),
                        rules = count,
                        "Loaded filter list"
                    );
                }
                Err(e) => {
                    tracing::warn!(
                        file = %path.display(),
                        error = %e,
                        "Failed to read filter list, skipping"
                    );
                }
            }
        }

        if all_rules.is_empty() {
            return Ok(0);
        }

        // Build a new engine with all rules
        let mut filter_set = FilterSet::new(true);
        let mut total_rules = 0;
        for rules_text in &all_rules {
            let count = rules_text.lines().count();
            filter_set.add_filters(
                &rules_text.lines().map(String::from).collect::<Vec<_>>(),
                ParseOptions::default(),
            );
            total_rules += count;
        }

        let new_engine = Engine::from_filter_set(filter_set, true);

        // Atomically swap the engine
        let mut engine = self.engine.write().await;
        *engine = new_engine;

        tracing::info!(total_rules, "Adblock engine loaded with filter rules");

        Ok(total_rules)
    }

    /// Check if a URL should be blocked.
    pub async fn check_network_request(
        &self,
        url: &str,
        source_url: &str,
        request_type: &str,
    ) -> BlockResult {
        let engine = self.engine.read().await;

        let request = match Request::new(url, source_url, request_type) {
            Ok(r) => r,
            Err(_) => {
                return BlockResult {
                    matched: false,
                    has_exception: false,
                    filter: None,
                };
            }
        };

        let result = engine.check_network_request(&request);

        BlockResult {
            matched: result.matched,
            has_exception: result.exception.is_some(),
            filter: result.filter.map(|f| f.to_string()),
        }
    }

    pub async fn get_cosmetic_filters(&self, url: &str) -> CosmeticResult {
        let engine = self.engine.read().await;
        let resources = engine.url_cosmetic_resources(url);

        CosmeticResult {
            hide_selectors: resources.hide_selectors.into_iter().collect(),
            style_selectors: Vec::new(),
            injected_script: resources.injected_script,
        }
    }

    /// Load built-in DoH blocking rules into the engine.
    /// These rules block known DNS-over-HTTPS endpoints at the URL level,
    /// preventing browsers from bypassing the filtered DNS proxy.
    /// These are always active when the engine is loaded  - they cannot be disabled.
    pub async fn load_builtin_doh_rules(&self) {
        let rules: Vec<String> = BUILTIN_DOH_RULES
            .lines()
            .filter(|l| !l.trim().is_empty() && !l.starts_with('!'))
            .map(String::from)
            .collect();

        if rules.is_empty() {
            return;
        }

        let mut filter_set = FilterSet::new(true);
        filter_set.add_filters(&rules, ParseOptions::default());

        // We merge these into the existing engine by reloading with all rules
        // This happens during load_from_disk, so we just need to ensure the
        // built-in rules file exists on disk
        let builtin_path = self.lists_dir.join("_builtin_doh_rules.txt");
        if let Err(e) = tokio::fs::write(&builtin_path, BUILTIN_DOH_RULES).await {
            tracing::warn!(error = %e, "Failed to write built-in DoH rules to disk");
        }
    }

    /// Set a custom whitelist of domains
    pub async fn set_whitelist(&self, domains: Vec<String>) {
        if domains.is_empty() {
            let whitelist_path = self.lists_dir.join("_custom_whitelist.txt");
            let _ = tokio::fs::remove_file(whitelist_path).await;
        } else {
            let content = domains
                .iter()
                .map(|domain| format!("@@||{}^", domain))
                .collect::<Vec<_>>()
                .join("\n");
                
            let whitelist_path = self.lists_dir.join("_custom_whitelist.txt");
            if let Err(e) = tokio::fs::write(&whitelist_path, content).await {
                tracing::warn!(error = %e, "Failed to write whitelist to disk");
            }
        }
        
        // Reload all rules from disk to apply the new whitelist
        if let Err(e) = self.load_from_disk().await {
            tracing::warn!(error = %e, "Failed to reload engine after updating whitelist");
        }
    }
}

/// Built-in filter rules that block known DNS-over-HTTPS endpoints.
/// These prevent browsers from resolving DNS over HTTPS, which would
/// bypass the relay's DNS-level ad/tracker blocking.
///
/// These rules are always active and cannot be disabled by the user.
const BUILTIN_DOH_RULES: &str = r#"! Built-in DoH endpoint blocking rules (always active)
! These prevent browsers from bypassing DNS-level ad blocking via DoH
||dns.google/dns-query$xmlhttprequest,important
||dns.google/resolve$xmlhttprequest,important
||cloudflare-dns.com/dns-query$xmlhttprequest,important
||mozilla.cloudflare-dns.com/dns-query$xmlhttprequest,important
||one.one.one.one/dns-query$xmlhttprequest,important
||doh.opendns.com/dns-query$xmlhttprequest,important
||dns.quad9.net/dns-query$xmlhttprequest,important
||doh.cleanbrowsing.org/doh/*$xmlhttprequest,important
||dns.adguard-dns.com/dns-query$xmlhttprequest,important
||dns.adguard.com/dns-query$xmlhttprequest,important
||doh.dns.sb/dns-query$xmlhttprequest,important
||dns.nextdns.io/*$xmlhttprequest,important
||doh.xfinity.com/dns-query$xmlhttprequest,important
||odvr.nic.cz/doh$xmlhttprequest,important
||doh.li/dns-query$xmlhttprequest,important
||dns.switch.ch/dns-query$xmlhttprequest,important
||doh.applied-privacy.net/query$xmlhttprequest,important
"#;
