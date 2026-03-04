use anyhow::{Context, Result};
use relay_common::types::*;
use reqwest::Client;
use uuid::Uuid;

/// Client for interacting with Supabase REST API
pub struct SupabaseClient {
    http: Client,
    base_url: String,
    service_key: String,
}

impl SupabaseClient {
    pub fn new(base_url: &str, service_role_key: &str) -> Self {
        Self {
            http: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            service_key: service_role_key.to_string(),
        }
    }

    /// Common headers for Supabase REST API
    fn headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "apikey",
            self.service_key.parse().expect("Invalid service key: contains non-ASCII or control characters"),
        );
        headers.insert(
            "Authorization",
            format!("Bearer {}", self.service_key)
                .parse()
                .expect("Invalid service key for Authorization header"),
        );
        headers.insert("Content-Type", "application/json".parse().unwrap());
        headers.insert("Prefer", "return=representation".parse().unwrap());
        headers
    }

    /// Register this server in the relay_servers table (upsert on hostname)
    pub async fn register_server(&self, registration: &ServerRegistration) -> Result<RelayServer> {
        let url = format!(
            "{}/rest/v1/relay_servers?on_conflict=hostname",
            self.base_url
        );

        let response = self
            .http
            .post(&url)
            .headers(self.headers())
            .header("Prefer", "return=representation,resolution=merge-duplicates")
            .json(registration)
            .send()
            .await
            .context("Failed to register server with Supabase")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Server registration failed ({status}): {body}");
        }

        let servers: Vec<RelayServer> = response
            .json()
            .await
            .context("Failed to parse registration response")?;

        servers
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("No server returned from registration"))
    }

    /// Send heartbeat update
    pub async fn send_heartbeat(&self, server_id: &Uuid, heartbeat: &Heartbeat) -> Result<()> {
        let url = format!(
            "{}/rest/v1/relay_servers?id=eq.{}",
            self.base_url, server_id
        );

        let response = self
            .http
            .patch(&url)
            .headers(self.headers())
            .json(heartbeat)
            .send()
            .await
            .context("Failed to send heartbeat")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Heartbeat failed ({status}): {body}");
        }

        Ok(())
    }

    /// Get all online relay servers (for mesh discovery)
    pub async fn get_online_servers(&self, exclude_id: &Uuid) -> Result<Vec<RelayServer>> {
        let url = format!(
            "{}/rest/v1/relay_servers?status=in.(online,degraded)&id=neq.{}",
            self.base_url, exclude_id
        );

        let response = self
            .http
            .get(&url)
            .headers(self.headers())
            .send()
            .await
            .context("Failed to fetch online servers")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Failed to fetch servers ({status}): {body}");
        }

        response
            .json()
            .await
            .context("Failed to parse server list")
    }

    /// Report latency metrics via RPC (calls upsert_relay_metric function)
    pub async fn report_metric(&self, metric: &RelayMetric) -> Result<()> {
        let url = format!("{}/rest/v1/rpc/upsert_relay_metric", self.base_url);

        let payload = serde_json::json!({
            "p_source_id": metric.source_id,
            "p_target_id": metric.target_id,
            "p_rtt_ms": metric.rtt_ms,
            "p_jitter_ms": metric.jitter_ms,
            "p_packet_loss": metric.packet_loss,
        });

        let response = self
            .http
            .post(&url)
            .headers(self.headers())
            .json(&payload)
            .send()
            .await
            .context("Failed to report metric")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::warn!("Metric report failed ({status}): {body}");
        }

        Ok(())
    }

    /// Batch report multiple metrics
    pub async fn report_metrics(&self, metrics: &[RelayMetric]) -> Result<()> {
        for metric in metrics {
            if let Err(e) = self.report_metric(metric).await {
                tracing::warn!(
                    source = %metric.source_id,
                    target = %metric.target_id,
                    error = %e,
                    "Failed to report metric"
                );
            }
        }
        Ok(())
    }

    /// Get cached optimal path between two servers
    pub async fn get_cached_path(
        &self,
        entry_id: &Uuid,
        exit_id: &Uuid,
    ) -> Result<Option<RelayPath>> {
        let url = format!(
            "{}/rest/v1/relay_paths_cache?entry_server_id=eq.{}&exit_server_id=eq.{}",
            self.base_url, entry_id, exit_id
        );

        let response = self
            .http
            .get(&url)
            .headers(self.headers())
            .send()
            .await
            .context("Failed to fetch cached path")?;

        if !response.status().is_success() {
            return Ok(None);
        }

        let paths: Vec<RelayPath> = response.json().await.unwrap_or_default();
        Ok(paths.into_iter().next())
    }

    /// Compute optimal path via RPC
    pub async fn compute_path(
        &self,
        entry_id: &Uuid,
        exit_id: &Uuid,
    ) -> Result<Option<ComputedPath>> {
        let url = format!("{}/rest/v1/rpc/compute_optimal_path", self.base_url);

        let payload = serde_json::json!({
            "p_entry_id": entry_id,
            "p_exit_id": exit_id,
        });

        let response = self
            .http
            .post(&url)
            .headers(self.headers())
            .json(&payload)
            .send()
            .await
            .context("Failed to compute path")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Path computation failed ({status}): {body}");
        }

        let paths: Vec<ComputedPath> = response.json().await.unwrap_or_default();
        Ok(paths.into_iter().next())
    }

    /// Create a user session
    pub async fn create_session(&self, session: &UserSession) -> Result<UserSession> {
        let url = format!("{}/rest/v1/user_sessions", self.base_url);

        let response = self
            .http
            .post(&url)
            .headers(self.headers())
            .json(session)
            .send()
            .await
            .context("Failed to create session")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Session creation failed ({status}): {body}");
        }

        let sessions: Vec<UserSession> = response
            .json()
            .await
            .context("Failed to parse session response")?;

        sessions
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("No session returned"))
    }

    /// Update server status
    pub async fn update_status(&self, server_id: &Uuid, status: &ServerStatus) -> Result<()> {
        let url = format!(
            "{}/rest/v1/relay_servers?id=eq.{}",
            self.base_url, server_id
        );

        let payload = serde_json::json!({
            "status": status,
            "updated_at": chrono::Utc::now(),
        });

        let response = self
            .http
            .patch(&url)
            .headers(self.headers())
            .json(&payload)
            .send()
            .await
            .context("Failed to update status")?;

        if !response.status().is_success() {
            let status_code = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Status update failed ({status_code}): {body}");
        }

        Ok(())
    }
}
