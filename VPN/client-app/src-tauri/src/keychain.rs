use crate::errors::AppError;

const SERVICE_NAME: &str = "tunnely";

/// On Android, we need a writable data directory set at app startup since the
/// `dirs` crate does not support Android. Call `set_data_dir()` from lib.rs
/// during Tauri setup.
#[cfg(target_os = "android")]
static DATA_DIR: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();

#[cfg(target_os = "android")]
pub fn set_data_dir(path: std::path::PathBuf) {
    let _ = DATA_DIR.set(path);
}

pub struct Keychain;

// ─── Desktop: use the OS keyring ───
#[cfg(not(target_os = "android"))]
impl Keychain {
    pub fn store(key: &str, value: &str) -> Result<(), AppError> {
        let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(|e| {
            AppError::Keychain(format!("Failed to create keychain entry for '{key}': {e}"))
        })?;
        entry.set_password(value).map_err(|e| {
            AppError::Keychain(format!("Failed to store '{key}' in keychain: {e}"))
        })?;
        Ok(())
    }

    pub fn load(key: &str) -> Result<Option<String>, AppError> {
        let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(|e| {
            AppError::Keychain(format!("Failed to create keychain entry for '{key}': {e}"))
        })?;
        match entry.get_password() {
            Ok(val) => Ok(Some(val)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AppError::Keychain(format!(
                "Failed to load '{key}' from keychain: {e}"
            ))),
        }
    }

    pub fn delete(key: &str) -> Result<(), AppError> {
        let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(|e| {
            AppError::Keychain(format!("Failed to create keychain entry for '{key}': {e}"))
        })?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(AppError::Keychain(format!(
                "Failed to delete '{key}' from keychain: {e}"
            ))),
        }
    }
}

// ─── Android: use file-based storage in the app's private data directory ───
#[cfg(target_os = "android")]
impl Keychain {
    fn storage_path() -> Result<std::path::PathBuf, AppError> {
        let dir = DATA_DIR
            .get()
            .cloned()
            .ok_or_else(|| AppError::Keychain("Android data directory not initialized".into()))?;
        if !dir.exists() {
            std::fs::create_dir_all(&dir).map_err(|e| {
                AppError::Keychain(format!("Failed to create keychain storage dir: {e}"))
            })?;
        }
        Ok(dir.join("keystore.json"))
    }

    fn read_store() -> Result<std::collections::HashMap<String, String>, AppError> {
        let path = Self::storage_path()?;
        if !path.exists() {
            return Ok(std::collections::HashMap::new());
        }
        let data = std::fs::read_to_string(&path).map_err(|e| {
            AppError::Keychain(format!("Failed to read keystore: {e}"))
        })?;
        serde_json::from_str(&data).map_err(|e| {
            AppError::Keychain(format!("Failed to parse keystore: {e}"))
        })
    }

    fn write_store(store: &std::collections::HashMap<String, String>) -> Result<(), AppError> {
        let path = Self::storage_path()?;
        let data = serde_json::to_string(store).map_err(|e| {
            AppError::Keychain(format!("Failed to serialize keystore: {e}"))
        })?;
        std::fs::write(&path, data).map_err(|e| {
            AppError::Keychain(format!("Failed to write keystore: {e}"))
        })?;
        Ok(())
    }

    pub fn store(key: &str, value: &str) -> Result<(), AppError> {
        let mut store = Self::read_store()?;
        store.insert(key.to_string(), value.to_string());
        Self::write_store(&store)
    }

    pub fn load(key: &str) -> Result<Option<String>, AppError> {
        let store = Self::read_store()?;
        Ok(store.get(key).cloned())
    }

    pub fn delete(key: &str) -> Result<(), AppError> {
        let mut store = Self::read_store()?;
        store.remove(key);
        Self::write_store(&store)
    }
}

// ─── Shared convenience methods ───
impl Keychain {
    pub fn store_auth_token(access_token: &str, refresh_token: &str) -> Result<(), AppError> {
        Self::store("access_token", access_token)?;
        Self::store("refresh_token", refresh_token)?;
        Ok(())
    }

    pub fn load_auth_tokens() -> Result<Option<(String, String)>, AppError> {
        let access = Self::load("access_token")?;
        let refresh = Self::load("refresh_token")?;
        match (access, refresh) {
            (Some(a), Some(r)) => Ok(Some((a, r))),
            _ => Ok(None),
        }
    }

    pub fn clear_auth_tokens() -> Result<(), AppError> {
        Self::delete("access_token")?;
        Self::delete("refresh_token")?;
        Ok(())
    }

    pub fn store_wg_private_key(key: &str) -> Result<(), AppError> {
        Self::store("wg_private_key", key)
    }

    pub fn load_wg_private_key() -> Result<Option<String>, AppError> {
        Self::load("wg_private_key")
    }
}
