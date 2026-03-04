#[cfg(not(mobile))]
mod adblock;
#[cfg(mobile)]
mod adblock_mobile;
#[cfg(not(mobile))]
mod cli;
mod commands;
mod dns_filter;
mod errors;
mod iap_plugin;
mod keychain;
mod latency;
mod preferences;
mod state;
mod supabase;
#[cfg(not(mobile))]
mod tray;
mod tunnel;
#[cfg(not(mobile))]
mod updater;
#[cfg(mobile)]
mod vpn_plugin;

use commands::SupabaseState;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg(not(mobile))]
use commands::AdblockState;

use commands::TunnelState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── CLI mode (desktop only) ──
    #[cfg(not(mobile))]
    {
        let args: Vec<String> = std::env::args().collect();
        let is_cli_mode = args.iter().any(|arg| {
            arg == "--activate-trial" || arg == "-a" || 
            arg == "--generate-key" || arg == "-g" || 
            arg == "--help" || arg == "-h"
        });

        if is_cli_mode {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                cli::run_cli(args).await;
            });
            std::process::exit(0);
        }
    }

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let supabase_url = option_env!("SUPABASE_URL")
        .unwrap_or("http://localhost:54321")
        .to_string();
    let supabase_anon_key = option_env!("SUPABASE_ANON_KEY")
        .unwrap_or("your-anon-key")
        .to_string();

    let supabase_client: SupabaseState = Arc::new(supabase::SupabaseClient::new(
        supabase_url,
        supabase_anon_key,
    ));
    let app_state = state::new_shared_state();
    let tunnel_state: TunnelState = Arc::new(RwLock::new(tunnel::TunnelManager::new()));
    let pkce_state: commands::PkceState = Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new()));

    // ── Initialize adblock service (desktop only) ──
    #[cfg(not(mobile))]
    let adblock_state: AdblockState = {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("tunnely");

        match adblock::AdblockService::new(data_dir) {
            Ok(service) => Arc::new(RwLock::new(service)),
            Err(e) => {
                tracing::error!(error = %e, "Failed to initialize adblock service, using dummy");
                let fallback_dir = std::env::temp_dir().join("tunnely-fallback");
                Arc::new(RwLock::new(
                    adblock::AdblockService::new(fallback_dir)
                        .expect("Fallback adblock init should not fail"),
                ))
            }
        }
    };

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(supabase_client)
        .manage(app_state)
        .manage(tunnel_state)
        .manage(pkce_state);

    // Register the VPN mobile plugin (mobile only)
    #[cfg(mobile)]
    {
        builder = builder.plugin(vpn_plugin::init());
    }

    #[cfg(not(mobile))]
    {
        builder = builder.manage(adblock_state);
    }

    builder
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::start_oauth_flow,
            commands::finish_oauth_flow,
            commands::login,
            commands::signup,
            commands::activate_trial_key,
            commands::logout,
            commands::get_auth_state,
            commands::get_subscription,
            // Servers
            commands::fetch_servers,
            commands::get_recommended_server,
            // Connection
            commands::connect,
            commands::disconnect,
            commands::get_connection_status,
            // Location
            commands::get_user_location,
            // Latency
            commands::ping_servers,
            // Favorites
            commands::load_favorites,
            commands::save_favorites,
            // Recents
            commands::load_recents,
            commands::save_recents,
            // Preferences
            commands::load_preferences,
            commands::save_preferences,
            // Bonding
            commands::get_local_interfaces,
            commands::get_bonding_status,
            commands::set_bonding_mode,
            commands::toggle_channel_enabled,
            // Adblock (desktop only  - mobile stubs return errors)
            commands::enable_adblock,
            commands::disable_adblock,
            commands::get_adblock_status,
            commands::get_adblock_stats,
            commands::install_adblock_ca,
            commands::get_adblock_ca_path,
            commands::update_adblock_filters,
            commands::get_adblock_whitelist,
            commands::add_adblock_whitelist,
            commands::remove_adblock_whitelist,
            commands::get_adblock_filter_level,
            commands::set_adblock_filter_level,
            commands::set_adblock_debug_logging,
            commands::get_adblock_debug_logging,
            commands::reset_adblock_stats,
            // Update (desktop only  - mobile stubs return errors)
            commands::check_for_updates,
            commands::download_update,
            commands::install_update,
            // In-App Purchases (mobile only  - desktop stubs return errors)
            commands::get_iap_products,
            commands::validate_iap_purchase,
            commands::restore_iap_purchases,
        ])
        .setup(|app| {
            // Initialize Android-specific services
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                let data_dir = app.path().app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("/data/data/org.tunnely.client/files"));

                // Set keychain storage directory
                keychain::set_data_dir(data_dir.clone());

                // Initialize mobile adblock service
                let mobile_adblock = adblock_mobile::MobileAdblockService::new(data_dir);
                let mobile_adblock_state: commands::MobileAdblockState = Arc::new(RwLock::new(mobile_adblock));
                app.manage(mobile_adblock_state);
            }

            // System tray (desktop only)
            #[cfg(not(mobile))]
            tray::setup_tray(app.handle())?;

            // On Windows, ensure wintun.dll is next to the exe.
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                if let Ok(resource_dir) = app.path().resource_dir() {
                    let src = resource_dir.join("wintun.dll");
                    if src.exists() {
                        if let Ok(exe_path) = std::env::current_exe() {
                            let dest = exe_path.parent().unwrap().join("wintun.dll");
                            if !dest.exists() {
                                match std::fs::copy(&src, &dest) {
                                    Ok(_) => tracing::info!("Copied wintun.dll to exe directory"),
                                    Err(e) => tracing::warn!(error = %e, "Failed to copy wintun.dll to exe directory"),
                                }
                            }
                        }
                    }
                }
            }
            
            // Deep link handler
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                use tauri::Emitter;
                
                let app_handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    println!("Deep link received in Rust: {:?}", urls);
                    for url in urls {
                        let url_str = url.to_string();
                        if url_str.contains("auth/callback") {
                            let _ = app_handle.emit("oauth-callback", url_str);
                        }
                    }
                });
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
