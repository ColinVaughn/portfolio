use anyhow::{Context, Result};
use serde::Deserialize;

/// Validate a user JWT token with Supabase Auth
pub async fn verify_user_token(
    supabase_url: &str,
    token: &str,
) -> Result<AuthUser> {
    let client = reqwest::Client::new();
    let url = format!("{}/auth/v1/user", supabase_url);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("apikey", token)
        .send()
        .await
        .context("Failed to verify user token")?;

    if !response.status().is_success() {
        anyhow::bail!("Invalid or expired token");
    }

    response
        .json::<AuthUser>()
        .await
        .context("Failed to parse auth response")
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuthUser {
    pub id: uuid::Uuid,
    pub email: Option<String>,
    pub role: Option<String>,
}
