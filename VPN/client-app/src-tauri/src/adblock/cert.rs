use anyhow::{Context, Result};
use rcgen::{CertificateParams, DistinguishedName, DnType, DnValue, KeyPair};
use rustls::pki_types::CertificateDer;
use std::path::{Path, PathBuf};

/// Manages Root CA generation, storage, and per-domain certificate signing.
pub struct CertManager {
    /// Path where root CA cert is stored on disk
    ca_cert_path: PathBuf,
}

impl CertManager {
    /// Load or generate a Root CA. Stores the CA cert and key in the given directory.
    pub fn load_or_generate(data_dir: &Path) -> Result<Self> {
        let ca_dir = data_dir.join("adblock");
        std::fs::create_dir_all(&ca_dir).context("Failed to create adblock data directory")?;

        let ca_cert_path = ca_dir.join("rootCA.pem");
        let ca_key_path = ca_dir.join("rootCA-key.pem");

        if ca_cert_path.exists() && ca_key_path.exists() {
            tracing::info!("Loading existing Root CA from {}", ca_cert_path.display());
        } else {
            // Generate new CA
            tracing::info!("Generating new Root CA certificate");
            let (params, key, _) = generate_root_ca()?;

            // Save to disk
            let cert = params
                .clone()
                .self_signed(&key)
                .context("Failed to self-sign root CA")?;
            std::fs::write(&ca_cert_path, cert.pem())
                .context("Failed to write Root CA certificate")?;
            std::fs::write(&ca_key_path, key.serialize_pem())
                .context("Failed to write Root CA private key")?;

            // Set restrictive permissions on the key file (Unix only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&ca_key_path, std::fs::Permissions::from_mode(0o600))?;
            }

            tracing::info!(
                cert = %ca_cert_path.display(),
                key = %ca_key_path.display(),
                "Root CA generated and saved"
            );
        }

        Ok(Self { ca_cert_path })
    }

    /// Get the path to the Root CA certificate PEM file (for system trust store installation).
    pub fn ca_cert_path(&self) -> &Path {
        &self.ca_cert_path
    }

    /// Install the Root CA certificate into the system trust store.
    /// Platform-specific implementation.
    pub fn install_root_ca(&self) -> Result<String> {
        let cert_path = self.ca_cert_path.to_string_lossy().to_string();

        #[cfg(target_os = "windows")]
        {
            let output = std::process::Command::new("certutil")
                .args(["-addstore", "-user", "Root", &cert_path])
                .output()
                .context("Failed to run certutil")?;

            if output.status.success() {
                Ok("Root CA installed to Windows user trust store.".into())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                anyhow::bail!("certutil failed: {stderr}")
            }
        }

        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("security")
                .args([
                    "add-trusted-cert",
                    "-d",
                    "-r",
                    "trustRoot",
                    "-k",
                    "/Library/Keychains/System.keychain",
                    &cert_path,
                ])
                .output()
                .context("Failed to run security command")?;

            if output.status.success() {
                Ok("Root CA installed to macOS System Keychain.".into())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                anyhow::bail!("security add-trusted-cert failed: {stderr}")
            }
        }

        #[cfg(target_os = "linux")]
        {
            let dest = "/usr/local/share/ca-certificates/tunnely-adblock.crt";
            std::fs::copy(&cert_path, dest)
                .context("Failed to copy Root CA to ca-certificates directory")?;

            let output = std::process::Command::new("update-ca-certificates")
                .output()
                .context("Failed to run update-ca-certificates")?;

            if output.status.success() {
                Ok("Root CA installed to Linux system trust store.".into())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                anyhow::bail!("update-ca-certificates failed: {stderr}")
            }
        }
    }
}

/// Generate a self-signed Root CA certificate and keypair.
fn generate_root_ca() -> Result<(CertificateParams, KeyPair, CertificateDer<'static>)> {
    let mut params = CertificateParams::default();

    let mut dn = DistinguishedName::new();
    dn.push(
        DnType::CommonName,
        DnValue::Utf8String("Tunnely Adblock Root CA".to_string()),
    );
    dn.push(
        DnType::OrganizationName,
        DnValue::Utf8String("Tunnely".to_string()),
    );
    params.distinguished_name = dn;

    // CA-specific settings
    params.is_ca = rcgen::IsCa::Ca(rcgen::BasicConstraints::Unconstrained);
    params.key_usages = vec![
        rcgen::KeyUsagePurpose::KeyCertSign,
        rcgen::KeyUsagePurpose::CrlSign,
        rcgen::KeyUsagePurpose::DigitalSignature,
    ];

    // Valid for 10 years
    params.not_before = rcgen::date_time_ymd(2024, 1, 1);
    params.not_after = rcgen::date_time_ymd(2034, 12, 31);

    let key = KeyPair::generate().context("Failed to generate Root CA key pair")?;

    let cert = params
        .clone()
        .self_signed(&key)
        .context("Failed to self-sign Root CA certificate")?;

    let cert_der = CertificateDer::from(cert.der().to_vec());

    Ok((params, key, cert_der))
}
