use thiserror::Error;

#[derive(Error, Debug)]
pub enum RelayError {
    #[error("WireGuard error: {0}")]
    WireGuard(String),

    #[error("Supabase error: {0}")]
    Supabase(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Mesh error: {0}")]
    Mesh(String),

    #[error("Routing error: {0}")]
    Routing(String),

    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),
}
