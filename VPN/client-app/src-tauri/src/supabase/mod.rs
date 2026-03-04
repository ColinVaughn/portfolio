pub mod auth;
pub mod servers;

use reqwest::Client;

pub struct SupabaseClient {
    http: Client,
    url: String,
    anon_key: String,
}

impl SupabaseClient {
    pub fn new(url: String, anon_key: String) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            http,
            url,
            anon_key,
        }
    }

    pub fn url(&self) -> &str {
        &self.url
    }

    pub fn anon_key(&self) -> &str {
        &self.anon_key
    }

    pub fn http(&self) -> &Client {
        &self.http
    }

    /// Mark a session as terminated in the database
    pub async fn terminate_session(
        &self,
        access_token: &str,
        session_id: &uuid::Uuid,
    ) -> Result<(), crate::errors::AppError> {
        let url = format!(
            "{}/rest/v1/user_sessions?id=eq.{}",
            self.url, session_id
        );

        let resp = self.http
            .patch(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {access_token}"))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .json(&serde_json::json!({
                "status": "terminated",
                "disconnected_at": chrono::Utc::now().to_rfc3339()
            }))
            .send()
            .await
            .map_err(|e| crate::errors::AppError::Network(e.to_string()))?;

        if resp.status().is_success() {
            tracing::info!(%session_id, "Session terminated in database");
        } else {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(%session_id, %status, %body, "Failed to terminate session");
        }

        Ok(())
    }
}
