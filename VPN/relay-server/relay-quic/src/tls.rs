use anyhow::{Context, Result};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use std::path::Path;
use std::sync::Arc;

/// TLS certificate configuration for the QUIC server
pub struct TlsConfig {
    pub cert_chain: Vec<CertificateDer<'static>>,
    pub private_key: PrivateKeyDer<'static>,
}

impl TlsConfig {
    /// Load TLS certificate and key from PEM files on disk
    pub fn from_pem_files(cert_path: &Path, key_path: &Path) -> Result<Self> {
        let cert_data = std::fs::read(cert_path)
            .with_context(|| format!("Failed to read cert file: {}", cert_path.display()))?;
        let key_data = std::fs::read(key_path)
            .with_context(|| format!("Failed to read key file: {}", key_path.display()))?;

        let cert_chain: Vec<CertificateDer<'static>> =
            rustls_pemfile::certs(&mut cert_data.as_slice())
                .collect::<Result<Vec<_>, _>>()
                .context("Failed to parse certificate PEM")?;

        if cert_chain.is_empty() {
            anyhow::bail!("No certificates found in PEM file");
        }

        let private_key = rustls_pemfile::private_key(&mut key_data.as_slice())
            .context("Failed to parse private key PEM")?
            .ok_or_else(|| anyhow::anyhow!("No private key found in PEM file"))?;

        tracing::info!(
            certs = cert_chain.len(),
            cert_path = %cert_path.display(),
            "TLS certificates loaded"
        );

        Ok(Self {
            cert_chain,
            private_key,
        })
    }

    /// Generate a self-signed certificate for development/testing
    pub fn generate_self_signed(hostname: &str) -> Result<Self> {
        let subject_alt_names = vec![hostname.to_string()];

        let cert_params = rcgen::CertificateParams::new(subject_alt_names)
            .context("Failed to create certificate params")?;

        let key_pair = rcgen::KeyPair::generate()
            .context("Failed to generate key pair")?;

        let cert = cert_params
            .self_signed(&key_pair)
            .context("Failed to generate self-signed certificate")?;

        let cert_der = CertificateDer::from(cert.der().to_vec());
        let key_der = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(
            key_pair.serialize_der(),
        ));

        tracing::info!(
            hostname,
            "Self-signed TLS certificate generated"
        );

        Ok(Self {
            cert_chain: vec![cert_der],
            private_key: key_der,
        })
    }

    /// Load from disk if files exist, otherwise generate self-signed
    pub fn load_or_generate(
        cert_path: &Path,
        key_path: &Path,
        hostname: &str,
    ) -> Result<Self> {
        if cert_path.exists() && key_path.exists() {
            Self::from_pem_files(cert_path, key_path)
        } else {
            tracing::info!("No TLS certificates found, generating self-signed");
            let config = Self::generate_self_signed(hostname)?;

            // Save for reuse across restarts
            if let Some(parent) = cert_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            // Write self-signed cert and key as PEM
            let cert_pem = pem::encode(&pem::Pem::new(
                "CERTIFICATE",
                config.cert_chain[0].as_ref().to_vec(),
            ));
            std::fs::write(cert_path, cert_pem)?;

            let key_bytes = match &config.private_key {
                PrivateKeyDer::Pkcs8(k) => k.secret_pkcs8_der().to_vec(),
                PrivateKeyDer::Pkcs1(k) => k.secret_pkcs1_der().to_vec(),
                PrivateKeyDer::Sec1(k) => k.secret_sec1_der().to_vec(),
                _ => {
                    anyhow::bail!("Unsupported private key format for PEM serialization");
                }
            };
            let key_pem = pem::encode(&pem::Pem::new(
                "PRIVATE KEY",
                key_bytes,
            ));
            std::fs::write(key_path, key_pem)?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(key_path, std::fs::Permissions::from_mode(0o600))?;
            }

            Ok(config)
        }
    }

    /// Build a rustls ServerConfig from this TLS config
    pub fn into_rustls_server_config(self) -> Result<rustls::ServerConfig> {
        let mut server_crypto = rustls::ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(self.cert_chain, self.private_key)
            .context("Failed to build TLS server config")?;

        // Set ALPN to look like HTTP/3 traffic
        server_crypto.alpn_protocols = vec![b"h3".to_vec(), b"hq-29".to_vec()];

        Ok(server_crypto)
    }

    /// Build a rustls ServerConfig suitable for QUIC
    pub fn into_quinn_server_config(self) -> Result<quinn::ServerConfig> {
        let rustls_config = self.into_rustls_server_config()?;
        let quic_crypto = quinn::crypto::rustls::QuicServerConfig::try_from(rustls_config)
            .context("Failed to create QUIC server config")?;

        let mut server_config = quinn::ServerConfig::with_crypto(Arc::new(quic_crypto));

        // Configure transport for VPN use
        let mut transport = quinn::TransportConfig::default();
        // Enable datagrams (RFC 9221) - max size 65535
        transport.datagram_receive_buffer_size(Some(65535));
        // Keep connections alive
        transport.keep_alive_interval(Some(std::time::Duration::from_secs(15)));
        // Allow connection migration (important for mobile)
        server_config.migration(true);

        server_config.transport_config(Arc::new(transport));

        Ok(server_config)
    }
}
