use crate::errors::AppError;
use crate::state::UserProfile;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::SupabaseClient;

#[derive(Debug, Serialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct AuthResponse {
    access_token: String,
    refresh_token: String,
    user: AuthUser,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct AnonAuthResponse {
    access_token: String,
    refresh_token: String,
    user: AuthUser,
}

#[derive(Debug, Deserialize)]
struct AuthUser {
    id: Uuid,
    email: String,
}

#[derive(Debug, Serialize)]
struct RefreshRequest {
    refresh_token: String,
}

#[derive(Debug, Deserialize)]
struct RefreshResponse {
    access_token: String,
    refresh_token: String,
}
#[derive(Debug, Serialize)]
struct PkceExchangeRequest {
    grant_type: String,
    auth_code: String,
    code_verifier: String,
}

impl SupabaseClient {
    pub async fn login(&self, email: &str, password: &str) -> Result<(UserProfile, String, String), AppError> {
        let url = format!("{}/auth/v1/token?grant_type=password", self.url());

        let resp = self
            .http()
            .post(&url)
            .header("apikey", self.anon_key())
            .header("Content-Type", "application/json")
            .json(&LoginRequest {
                email: email.to_string(),
                password: password.to_string(),
            })
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!(
                "Login failed ({status}): {body}"
            )));
        }

        let auth: AuthResponse = resp.json().await.map_err(|e| {
            AppError::Auth(format!("Failed to parse auth response: {e}"))
        })?;

        let profile = UserProfile {
            id: auth.user.id,
            email: auth.user.email,
        };

        Ok((profile, auth.access_token, auth.refresh_token))
    }

    pub async fn signup(&self, email: &str, password: &str) -> Result<(UserProfile, String, String), AppError> {
        let url = format!("{}/auth/v1/signup", self.url());

        let resp = self
            .http()
            .post(&url)
            .header("apikey", self.anon_key())
            .header("Content-Type", "application/json")
            .json(&LoginRequest {
                email: email.to_string(),
                password: password.to_string(),
            })
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!(
                "Signup failed ({status}): {body}"
            )));
        }

        let json_body: serde_json::Value = resp.json().await.map_err(|e| {
            AppError::Auth(format!("Failed to parse signup response: {e}"))
        })?;

        // Supabase returns either a Session (with access_token) or a User (if email confirmation is required)
        let access_token = json_body["access_token"].as_str().unwrap_or("").to_string();
        let refresh_token = json_body["refresh_token"].as_str().unwrap_or("").to_string();

        let user_obj = if json_body.get("user").is_some() {
            &json_body["user"]
        } else {
            &json_body
        };

        let id = user_obj["id"]
            .as_str()
            .and_then(|id| id.parse::<Uuid>().ok())
            .unwrap_or_else(Uuid::nil);

        let returned_email = user_obj["email"].as_str().unwrap_or(email).to_string();
        
        let profile = UserProfile {
            id,
            email: returned_email,
        };

        Ok((profile, access_token, refresh_token))
    }

    pub async fn login_anonymous(&self) -> Result<(UserProfile, String, String), AppError> {
        let url = format!("{}/auth/v1/signup", self.url());

        let resp = self
            .http()
            .post(&url)
            .header("apikey", self.anon_key())
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "data": { "is_anonymous": true }
            }))
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!(
                "Anonymous login failed ({status}): {body}"
            )));
        }

        let json_body: serde_json::Value = resp.json().await.map_err(|e| {
            AppError::Auth(format!("Failed to parse anonymous login response: {e}"))
        })?;

        let access_token = json_body["access_token"].as_str().unwrap_or("").to_string();
        let refresh_token = json_body["refresh_token"].as_str().unwrap_or("").to_string();

        let user_obj = if json_body.get("user").is_some() {
            &json_body["user"]
        } else {
            &json_body
        };

        let id = user_obj["id"]
            .as_str()
            .and_then(|id| id.parse::<Uuid>().ok())
            .unwrap_or_else(Uuid::nil);

        let profile = UserProfile {
            id,
            email: "integrator-trial@anon.system".to_string(),
        };

        Ok((profile, access_token, refresh_token))
    }

    pub async fn refresh_token(&self, refresh_token: &str) -> Result<(String, String), AppError> {
        let url = format!("{}/auth/v1/token?grant_type=refresh_token", self.url());

        let resp = self
            .http()
            .post(&url)
            .header("apikey", self.anon_key())
            .header("Content-Type", "application/json")
            .json(&RefreshRequest {
                refresh_token: refresh_token.to_string(),
            })
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!(
                "Token refresh failed ({status}): {body}"
            )));
        }

        let refreshed: RefreshResponse = resp.json().await.map_err(|e| {
            AppError::Auth(format!("Failed to parse refresh response: {e}"))
        })?;

        Ok((refreshed.access_token, refreshed.refresh_token))
    }

    pub async fn get_user(&self, access_token: &str) -> Result<UserProfile, AppError> {
        let url = format!("{}/auth/v1/user", self.url());

        let resp = self
            .http()
            .get(&url)
            .header("apikey", self.anon_key())
            .header("Authorization", format!("Bearer {access_token}"))
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(AppError::Auth("Invalid or expired token".to_string()));
        }

        let user: AuthUser = resp.json().await.map_err(|e| {
            AppError::Auth(format!("Failed to parse user response: {e}"))
        })?;

        Ok(UserProfile {
            id: user.id,
            email: user.email,
        })
    }

    /// Generates a Supabase OAuth URL with PKCE parameters for deep-linking
    pub fn generate_pkce_oauth_url(
        &self,
        provider: &str,
    ) -> Result<(String, String, String), AppError> {
        use rand::Rng;
        use sha2::{Digest, Sha256};
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};

        let mut rng = rand::thread_rng();
        let verifier_bytes: Vec<u8> = (0..64).map(|_| {
            let idx = rng.gen_range(0..66);
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[idx]
        }).collect();
        let code_verifier = String::from_utf8(verifier_bytes).unwrap_or_else(|_| "backup-verifier-string-since-this-cant-fail".to_string());

        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let hash = hasher.finalize();
        let code_challenge = URL_SAFE_NO_PAD.encode(hash);

        let mut url = url::Url::parse(&format!("{}/auth/v1/authorize", self.url()))
            .map_err(|e| AppError::Auth(format!("Failed to parse authorize URL: {e}")))?;

        url.query_pairs_mut()
            .append_pair("provider", provider)
            .append_pair("redirect_to", "tunnely://auth/callback")
            .append_pair("code_challenge", &code_challenge)
            .append_pair("code_challenge_method", "s256");

        Ok((url.to_string(), code_challenge, code_verifier))
    }

    /// Exchanges an OAuth PKCE Auth Code + Verifier for a Session
    pub async fn exchange_pkce_code(
        &self,
        auth_code: &str,
        code_verifier: &str,
    ) -> Result<(UserProfile, String, String), AppError> {
        let url = format!("{}/auth/v1/token?grant_type=pkce", self.url());

        let resp = self
            .http()
            .post(&url)
            .header("apikey", self.anon_key())
            .header("Content-Type", "application/json")
            .json(&PkceExchangeRequest {
                grant_type: "pkce".to_string(),
                auth_code: auth_code.to_string(),
                code_verifier: code_verifier.to_string(),
            })
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!(
                "PKCE Exchange failed ({status}): {body}"
            )));
        }

        let auth: AuthResponse = resp.json().await.map_err(|e| {
            AppError::Auth(format!("Failed to parse PKCE response: {e}"))
        })?;

        let profile = UserProfile {
            id: auth.user.id,
            email: auth.user.email,
        };

        Ok((profile, auth.access_token, auth.refresh_token))
    }
}
