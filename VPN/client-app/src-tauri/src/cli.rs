use crate::state;
use crate::supabase::SupabaseClient;
use std::sync::Arc;

pub async fn run_cli(args: Vec<String>) {
    // Basic argument parsing
    let mut activate_trial: Option<String> = None;
    let mut generate_key = false;
    let mut email: Option<String> = None;
    let mut password: Option<String> = None;

    let mut iter = args.into_iter();
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--activate-trial" | "-a" => {
                activate_trial = iter.next();
            }
            "--generate-key" | "-g" => {
                generate_key = true;
            }
            "--email" | "-u" => {
                email = iter.next();
            }
            "--password" | "-p" => {
                password = iter.next();
            }
            "--help" | "-h" => {
                print_help();
                return;
            }
            _ => {}
        }
    }

    let supabase_url = option_env!("SUPABASE_URL")
        .unwrap_or("http://localhost:54321")
        .to_string();
    let supabase_anon_key = option_env!("SUPABASE_ANON_KEY")
        .unwrap_or("your-anon-key")
        .to_string();

    let supabase_client = Arc::new(SupabaseClient::new(supabase_url, supabase_anon_key));

    if let Some(trial_key) = activate_trial {
        println!("Activating Integrator Trial: {}...", trial_key);
        
        // 1. Authenticate anonymously directly via client
        match supabase_client.login_anonymous().await {
            Ok((profile, access_token, refresh_token)) => {
                // 2. Claim the key via RPC directly
                let rpc_url = format!("{}/rest/v1/rpc/claim_trial_key", supabase_client.url());
                let req_body = serde_json::json!({ "p_trial_key": trial_key });
                
                match supabase_client
                    .http()
                    .post(&rpc_url)
                    .header("apikey", supabase_client.anon_key())
                    .header("Authorization", format!("Bearer {}", access_token))
                    .header("Content-Type", "application/json")
                    .json(&req_body)
                    .send()
                    .await 
                {
                    Ok(rpc_resp) => {
                        if !rpc_resp.status().is_success() {
                            let status = rpc_resp.status();
                            let body = rpc_resp.text().await.unwrap_or_default();
                            eprintln!("[ERROR] Trial activation failed ({status}): {body}");
                            return;
                        }
                        
                        // 3. Store tokens directly
                        let _ = crate::keychain::Keychain::store_auth_token(&access_token, &refresh_token);
                        println!("[SUCCESS] Activated Trial. Client bounded properly.");
                        println!("Account ID: {}", profile.id);
                    }
                    Err(e) => {
                        eprintln!("[ERROR] Failed to communicate with RPC: {:?}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("[ERROR] Anonymous authentication failed: {:?}", e);
            }
        }
        return;
    }

    if generate_key {
        let email = email.expect("--email is required for key generation");
        let password = password.expect("--password is required for key generation");

        println!("Authenticating Integrator: {}...", email);

        // Standard Login directly via client
        let auth_resp = match supabase_client.login(&email, &password).await {
            Ok((profile, access_token, refresh_token)) => {
                let _ = crate::keychain::Keychain::store_auth_token(&access_token, &refresh_token);
                profile
            },
            Err(e) => {
                eprintln!("[ERROR] Authentication Failed: {:?}", e);
                return;
            }
        };

        // Create random key
        use rand::RngCore;
        let mut key_bytes = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut key_bytes);
        
        let hex_string: String = key_bytes.iter().map(|b| format!("{:02x}", b)).collect();
        let new_key = format!("TRIAL-{}-{}-{}", &hex_string[0..8], &hex_string[8..12], &hex_string[12..20]).to_uppercase();

        println!("Minting Key via RPC...");
        
        // Re-extract tokens cleanly directly from keychain
        let (access_token, _) = crate::keychain::Keychain::load_auth_tokens()
            .unwrap_or(Some((String::new(), String::new())))
            .unwrap_or((String::new(), String::new()));
        
        let rpc_url = format!("{}/rest/v1/integrator_trials", supabase_client.url());
        
        let req_body = serde_json::json!({
            "integrator_id": auth_resp.id,
            "trial_key": &new_key,
            "status": "active"
        });

        let resp = match supabase_client
            .http()
            .post(&rpc_url)
            .header("apikey", supabase_client.anon_key())
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&req_body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[ERROR] Network failure generating key: {:?}", e);
                return;
            }
        };

        if resp.status().is_success() {
            println!("\n[SUCCESS] New Integrator Key Generated!");
            println!("------------------------------------------------");
            println!("{}", new_key);
            println!("------------------------------------------------");
        } else {
            eprintln!("[ERROR] RLS rejected key generation. Validate your account role is 'integrator' or 'admin'.");
            eprintln!("Response: {:?}", resp.text().await.unwrap_or_default());
        }
        return;
    }

    print_help();
}

fn print_help() {
    println!("Tunnely Native Client - Integrator CLI");
    println!("Usage:");
    println!("  --activate-trial, -a <KEY>                  Silently attach device to specific Trial Key.");
    println!("  --generate-key, -g -u <EMAIL> -p <PASS>     Mint a new Commercial activation key via API.");
}
