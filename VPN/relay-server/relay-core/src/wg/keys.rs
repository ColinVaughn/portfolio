use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::path::Path;
use x25519_dalek::{PublicKey, StaticSecret};

/// A WireGuard keypair (private + public)
#[derive(Clone)]
pub struct WgKeyPair {
    pub private_key: StaticSecret,
    pub public_key: PublicKey,
}

impl WgKeyPair {
    /// Generate a new random keypair
    pub fn generate() -> Self {
        let private_key = StaticSecret::random_from_rng(rand::thread_rng());
        let public_key = PublicKey::from(&private_key);
        Self {
            private_key,
            public_key,
        }
    }

    /// Get private key as base64 string (for WireGuard config)
    pub fn private_key_base64(&self) -> String {
        BASE64.encode(self.private_key.as_bytes())
    }

    /// Get public key as base64 string (for WireGuard config and Supabase registration)
    pub fn public_key_base64(&self) -> String {
        BASE64.encode(self.public_key.as_bytes())
    }

    /// Save keypair to files on disk
    pub fn save_to_dir(&self, dir: &Path, prefix: &str) -> Result<()> {
        std::fs::create_dir_all(dir)
            .with_context(|| format!("Failed to create key directory: {}", dir.display()))?;

        let private_path = dir.join(format!("{prefix}.key"));
        let public_path = dir.join(format!("{prefix}.pub"));

        std::fs::write(&private_path, self.private_key_base64())
            .with_context(|| format!("Failed to write private key: {}", private_path.display()))?;

        // Restrict permissions on private key (Unix only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&private_path, std::fs::Permissions::from_mode(0o600))?;
        }

        std::fs::write(&public_path, self.public_key_base64())
            .with_context(|| format!("Failed to write public key: {}", public_path.display()))?;

        tracing::info!(
            "Saved keypair: private={}, public={}",
            private_path.display(),
            public_path.display()
        );

        Ok(())
    }

    /// Load keypair from files on disk
    pub fn load_from_dir(dir: &Path, prefix: &str) -> Result<Self> {
        let private_path = dir.join(format!("{prefix}.key"));
        let public_path = dir.join(format!("{prefix}.pub"));

        if !private_path.exists() {
            anyhow::bail!("Private key not found: {}", private_path.display());
        }

        let private_b64 = std::fs::read_to_string(&private_path)
            .with_context(|| format!("Failed to read private key: {}", private_path.display()))?;

        let private_bytes = BASE64
            .decode(private_b64.trim())
            .context("Invalid base64 in private key")?;

        let private_bytes: [u8; 32] = private_bytes
            .try_into()
            .map_err(|_| anyhow::anyhow!("Private key must be exactly 32 bytes"))?;

        let private_key = StaticSecret::from(private_bytes);
        let public_key = PublicKey::from(&private_key);

        // Verify public key matches if file exists
        if public_path.exists() {
            let stored_pub = std::fs::read_to_string(&public_path)?;
            let computed_pub = BASE64.encode(public_key.as_bytes());
            if stored_pub.trim() != computed_pub {
                tracing::warn!("Public key file doesn't match private key, overwriting");
                std::fs::write(&public_path, computed_pub)?;
            }
        }

        tracing::info!("Loaded keypair from {}", dir.display());

        Ok(Self {
            private_key,
            public_key,
        })
    }

    /// Load from dir if exists, otherwise generate and save
    pub fn load_or_generate(dir: &Path, prefix: &str) -> Result<Self> {
        let private_path = dir.join(format!("{prefix}.key"));

        if private_path.exists() {
            Self::load_from_dir(dir, prefix)
        } else {
            tracing::info!("No existing keypair found, generating new one");
            let keypair = Self::generate();
            keypair.save_to_dir(dir, prefix)?;
            Ok(keypair)
        }
    }
}

impl std::fmt::Debug for WgKeyPair {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WgKeyPair")
            .field("public_key", &self.public_key_base64())
            .field("private_key", &"[redacted]")
            .finish()
    }
}
