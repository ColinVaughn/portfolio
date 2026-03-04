use crate::errors::AppError;
use crate::state::{AppPreferences, RecentConnection};
use std::path::PathBuf;
use uuid::Uuid;

/// Get the preferences file path in the app data directory.
fn prefs_dir() -> Result<PathBuf, AppError> {
    let dir = dirs::data_dir()
        .ok_or_else(|| AppError::Other("Cannot find app data directory".into()))?
        .join("tunnely");
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::Other(format!("Cannot create data directory: {e}")))?;
    Ok(dir)
}

fn read_json_file<T: serde::de::DeserializeOwned>(filename: &str) -> Result<T, AppError> {
    let path = prefs_dir()?.join(filename);
    let data = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Other(format!("Cannot read {filename}: {e}")))?;
    serde_json::from_str(&data)
        .map_err(|e| AppError::Other(format!("Cannot parse {filename}: {e}")))
}

fn write_json_file<T: serde::Serialize>(filename: &str, value: &T) -> Result<(), AppError> {
    let path = prefs_dir()?.join(filename);
    let data = serde_json::to_string_pretty(value)
        .map_err(|e| AppError::Other(format!("Cannot serialize {filename}: {e}")))?;
    std::fs::write(&path, data)
        .map_err(|e| AppError::Other(format!("Cannot write {filename}: {e}")))?;
    Ok(())
}

// ─── Favorites ───

pub fn load_favorites_from_disk() -> Result<Vec<Uuid>, AppError> {
    match read_json_file::<Vec<Uuid>>("favorites.json") {
        Ok(favs) => Ok(favs),
        Err(_) => Ok(Vec::new()),
    }
}

pub fn save_favorites_to_disk(favorites: &[Uuid]) -> Result<(), AppError> {
    write_json_file("favorites.json", &favorites)
}

// ─── Recent Connections ───

pub fn load_recents_from_disk() -> Result<Vec<RecentConnection>, AppError> {
    match read_json_file::<Vec<RecentConnection>>("recents.json") {
        Ok(recents) => Ok(recents),
        Err(_) => Ok(Vec::new()),
    }
}

pub fn save_recents_to_disk(recents: &[RecentConnection]) -> Result<(), AppError> {
    write_json_file("recents.json", &recents)
}

// ─── App Preferences ───

pub fn load_preferences_from_disk() -> Result<AppPreferences, AppError> {
    match read_json_file::<AppPreferences>("preferences.json") {
        Ok(prefs) => Ok(prefs),
        Err(_) => Ok(AppPreferences::default()),
    }
}

pub fn save_preferences_to_disk(prefs: &AppPreferences) -> Result<(), AppError> {
    write_json_file("preferences.json", prefs)
}
