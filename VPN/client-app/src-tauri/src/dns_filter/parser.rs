/// ABP (AdBlock Plus) filter list parser.
///
/// Extracts domain names from ABP-syntax filter rules. This is intentionally
/// simpler than the full Brave `adblock::Engine`  - we only care about
/// domain-level blocking rules (like `||doubleclick.net^`), not URL-level
/// patterns or cosmetic filters.
///
/// This keeps the mobile ad blocker lightweight and fast.

/// Extract blockable domains from ABP-syntax filter list text.
///
/// Supported rule formats:
/// - `||domain.com^`  - standard domain block rule
/// - `||subdomain.domain.com^`  - subdomain block rule  
/// - `||domain.com^$third-party`  - domain rule with options (options ignored, domain kept)
///
/// Ignored rules:
/// - Lines starting with `!` (comments)
/// - Lines starting with `#` (cosmetic filters)  
/// - Lines starting with `@@` (exception rules  - handled separately)
/// - Lines without `||` prefix (URL patterns, not pure domain rules)
/// - Lines containing `*` (wildcard URL patterns)
/// - Lines containing `/` after the domain (path-based rules)
pub fn extract_domains(filter_text: &str) -> (Vec<String>, Vec<String>) {
    let mut blocked = Vec::new();
    let mut exceptions = Vec::new();

    for line in filter_text.lines() {
        let line = line.trim();

        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('!') || line.starts_with('[') {
            continue;
        }

        // Skip cosmetic filters (##, #@#, #?# etc.)
        if line.contains("##") || line.contains("#@#") || line.contains("#?#") {
            continue;
        }

        // Exception rules: @@||domain.com^
        if line.starts_with("@@||") {
            if let Some(domain) = parse_domain_from_rule(&line[4..]) {
                exceptions.push(domain);
            }
            continue;
        }

        // Standard domain block rules: ||domain.com^
        if line.starts_with("||") {
            if let Some(domain) = parse_domain_from_rule(&line[2..]) {
                blocked.push(domain);
            }
            continue;
        }

        // Plain domain lines (some lists use bare domains per line)
        // e.g., "0.0.0.0 ads.google.com" or just "ads.google.com"
        if !line.contains('/') && !line.contains('*') && !line.starts_with('#') {
            // hosts file format: "0.0.0.0 domain" or "127.0.0.1 domain"
            if line.starts_with("0.0.0.0 ") || line.starts_with("127.0.0.1 ") {
                let domain = line.split_whitespace().nth(1).unwrap_or("").trim();
                if is_valid_domain(domain) {
                    blocked.push(domain.to_lowercase());
                }
            }
        }
    }

    (blocked, exceptions)
}

/// Parse a domain from an ABP rule body (after `||` or `@@||`).
///
/// Examples:
/// - `doubleclick.net^` → `doubleclick.net`
/// - `ads.google.com^$third-party` → `ads.google.com`
/// - `ads.google.com^$third-party,important` → `ads.google.com`
fn parse_domain_from_rule(rule_body: &str) -> Option<String> {
    // Find the end of the domain (^ or $ or end of string)
    let domain_end = rule_body
        .find(|c: char| c == '^' || c == '$' || c == '/' || c == '*')
        .unwrap_or(rule_body.len());

    let domain = &rule_body[..domain_end];

    // Skip if it contains path separators, wildcards, or is empty
    if domain.is_empty() || domain.contains('*') || domain.contains('/') {
        return None;
    }

    // Must look like a valid domain
    if is_valid_domain(domain) {
        Some(domain.to_lowercase())
    } else {
        None
    }
}

/// Basic domain validation  - must contain a dot, only valid chars.
fn is_valid_domain(domain: &str) -> bool {
    if domain.is_empty() || !domain.contains('.') {
        return false;
    }

    // Must start/end with alphanumeric
    let first = domain.chars().next().unwrap_or(' ');
    let last = domain.chars().last().unwrap_or(' ');
    if !first.is_alphanumeric() || !last.is_alphanumeric() {
        return false;
    }

    // Only allow alphanumeric, hyphens, dots
    domain
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '.')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_domain_rules() {
        let rules = "||doubleclick.net^\n||ads.google.com^\n||tracker.example.com^";
        let (blocked, _) = extract_domains(rules);
        assert!(blocked.contains(&"doubleclick.net".to_string()));
        assert!(blocked.contains(&"ads.google.com".to_string()));
        assert!(blocked.contains(&"tracker.example.com".to_string()));
    }

    #[test]
    fn test_rules_with_options() {
        let rules = "||facebook.net/tr^$third-party\n||pixel.facebook.com^$third-party,important";
        let (blocked, _) = extract_domains(rules);
        // facebook.net/tr^ has a `/` so it's skipped (path-based)
        assert!(!blocked.contains(&"facebook.net/tr".to_string()));
        assert!(blocked.contains(&"pixel.facebook.com".to_string()));
    }

    #[test]
    fn test_exception_rules() {
        let rules = "||ads.google.com^\n@@||safe.ads.google.com^";
        let (blocked, exceptions) = extract_domains(rules);
        assert!(blocked.contains(&"ads.google.com".to_string()));
        assert!(exceptions.contains(&"safe.ads.google.com".to_string()));
    }

    #[test]
    fn test_comments_and_cosmetic_skipped() {
        let rules = "! Comment\n##.ad-banner\n||real.domain.com^\n[Adblock Plus]";
        let (blocked, _) = extract_domains(rules);
        assert_eq!(blocked.len(), 1);
        assert!(blocked.contains(&"real.domain.com".to_string()));
    }

    #[test]
    fn test_hosts_format() {
        let rules = "0.0.0.0 ads.google.com\n127.0.0.1 tracker.com";
        let (blocked, _) = extract_domains(rules);
        assert!(blocked.contains(&"ads.google.com".to_string()));
        assert!(blocked.contains(&"tracker.com".to_string()));
    }

    #[test]
    fn test_invalid_domains_skipped() {
        let rules = "||^\n||.com^\n||-invalid.com^";
        let (blocked, _) = extract_domains(rules);
        assert!(blocked.is_empty());
    }
}
