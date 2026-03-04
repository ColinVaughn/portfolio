use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Emitter;

const WEBSITE_BASE_URL: &str = match option_env!("WEBSITE_BASE_URL") {
    Some(url) => url,
    None => "https://tunnely.org",
};

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

// ─── Types ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub update_available: bool,
    pub latest_version: String,
    pub download_url: String,
    pub release_notes: String,
    pub file_name: String,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: f64,
}

// ─── Platform Detection ───

fn current_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    }
}

// ─── Check for Updates ───

pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let platform = current_platform();
    let url = format!(
        "{}/api/update/check?platform={}&current={}",
        WEBSITE_BASE_URL, platform, CURRENT_VERSION
    );

    tracing::info!(url = %url, "Checking for updates");

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Network error checking for updates: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Update server returned status {}",
            resp.status().as_u16()
        ));
    }

    let info: UpdateInfo = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse update response: {}", e))?;

    tracing::info!(
        update_available = info.update_available,
        latest = %info.latest_version,
        current = %CURRENT_VERSION,
        "Update check complete"
    );

    Ok(info)
}

// ─── Download Update ───

pub async fn download_update(
    app_handle: &tauri::AppHandle,
    download_url: &str,
    file_name: &str,
) -> Result<PathBuf, String> {
    // Build absolute URL if relative
    let full_url = if download_url.starts_with('/') {
        format!("{}{}", WEBSITE_BASE_URL, download_url)
    } else {
        download_url.to_string()
    };

    tracing::info!(url = %full_url, file = %file_name, "Downloading update");

    let resp = reqwest::get(&full_url)
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Download server returned status {}",
            resp.status().as_u16()
        ));
    }

    let total_bytes = resp.content_length().unwrap_or(0);
    let dest_dir = std::env::temp_dir().join("tunnely-updates");
    std::fs::create_dir_all(&dest_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let dest_path = dest_dir.join(file_name);
    let mut file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        let percent = if total_bytes > 0 {
            (downloaded as f64 / total_bytes as f64) * 100.0
        } else {
            0.0
        };

        // Emit progress event to frontend
        let _ = app_handle.emit(
            "update-download-progress",
            DownloadProgress {
                downloaded_bytes: downloaded,
                total_bytes,
                percent,
            },
        );
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))?;

    tracing::info!(path = %dest_path.display(), bytes = downloaded, "Download complete");

    Ok(dest_path)
}

// ─── Install Update (Platform-Specific) ───

pub fn install_update(file_path: &str) -> Result<(), String> {
    let path = std::path::Path::new(file_path);

    if !path.exists() {
        return Err(format!("Update file not found: {}", file_path));
    }

    tracing::info!(path = %file_path, "Launching installer");

    #[cfg(target_os = "windows")]
    {
        install_windows(path)?;
    }

    #[cfg(target_os = "macos")]
    {
        install_macos(path)?;
    }

    #[cfg(target_os = "linux")]
    {
        install_linux(path)?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn install_windows(path: &std::path::Path) -> Result<(), String> {
    use std::process::Command;

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    match ext {
        "exe" => {
            // NSIS installer  - just run it
            Command::new(path)
                .spawn()
                .map_err(|e| format!("Failed to launch installer: {}", e))?;
        }
        "msi" => {
            // MSI  - use msiexec
            Command::new("msiexec")
                .args(["/i", &path.to_string_lossy()])
                .spawn()
                .map_err(|e| format!("Failed to launch MSI installer: {}", e))?;
        }
        _ => {
            return Err(format!("Unsupported installer format: .{}", ext));
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn install_macos(path: &std::path::Path) -> Result<(), String> {
    use std::process::Command;

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    if ext != "dmg" {
        return Err(format!("Unsupported installer format: .{}", ext));
    }

    // Open the DMG  - Finder will mount it and present the install dialog
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Failed to open DMG: {}", e))?;

    Ok(())
}

#[cfg(target_os = "linux")]
fn install_linux(path: &std::path::Path) -> Result<(), String> {
    use std::process::Command;

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    match ext {
        "AppImage" => {
            // Make executable and run
            Command::new("chmod")
                .args(["+x", &path.to_string_lossy()])
                .status()
                .map_err(|e| format!("Failed to chmod AppImage: {}", e))?;

            Command::new(path)
                .spawn()
                .map_err(|e| format!("Failed to launch AppImage: {}", e))?;
        }
        "deb" => {
            // Use pkexec for elevated install
            Command::new("pkexec")
                .args(["dpkg", "-i", &path.to_string_lossy()])
                .spawn()
                .map_err(|e| format!("Failed to install .deb package: {}", e))?;
        }
        _ => {
            return Err(format!("Unsupported installer format: .{}", ext));
        }
    }

    Ok(())
}
