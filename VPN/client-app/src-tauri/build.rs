fn main() {
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-env-changed=SUPABASE_URL");
    println!("cargo:rerun-if-env-changed=SUPABASE_ANON_KEY");
    println!("cargo:rerun-if-env-changed=WEBSITE_BASE_URL");

    // Load from parent directory .env
    if let Ok(iter) = dotenvy::from_path_iter("../.env") {
        for item in iter {
            if let Ok((key, val)) = item {
                // Forward the environment variables to rustc so option_env! can read them
                println!("cargo:rustc-env={}={}", key, val);
            }
        }
    }

    // On Windows, copy wintun.dll to the output directory so the TUN driver is
    // available alongside the binary at runtime.
    #[cfg(target_os = "windows")]
    {
        let out_dir = std::env::var("OUT_DIR").unwrap();
        // Walk up from OUT_DIR to the target profile directory (e.g. target/debug or target/release)
        let target_dir = std::path::Path::new(&out_dir)
            .ancestors()
            .nth(3)
            .expect("Could not find target directory");

        let wintun_src = std::path::Path::new("resources/wintun.dll");
        if wintun_src.exists() {
            let dest = target_dir.join("wintun.dll");
            std::fs::copy(wintun_src, &dest)
                .expect("Failed to copy wintun.dll to target directory");
            println!("cargo:warning=Copied wintun.dll to {}", dest.display());
        } else {
            println!("cargo:warning=wintun.dll not found at resources/wintun.dll  - TUN creation will fail on Windows");
        }

        println!("cargo:rerun-if-changed=resources/wintun.dll");
    }

    tauri_build::build()
}
