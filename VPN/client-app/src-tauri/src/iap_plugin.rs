/// In-App Purchase plugin bridge for mobile platforms.
///
/// Provides Tauri commands for querying products, making purchases,
/// and restoring previous purchases on Android (Google Play) and iOS (App Store).
///
/// On desktop, this module is not compiled (`#[cfg(mobile)]` gated).

#[cfg(mobile)]
use serde::{Deserialize, Serialize};

/// A subscription product available for purchase.
#[cfg(mobile)]
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IapProduct {
    pub id: String,
    pub title: String,
    pub description: String,
    pub price: String,
    pub currency: String,
    pub billing_period: String,
    #[serde(default)]
    pub offer_token: Option<String>, // Android only
}

/// A completed purchase result.
#[cfg(mobile)]
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IapPurchaseResult {
    /// Platform-specific: purchaseToken (Android) or signedTransaction JWS (iOS)
    pub receipt_data: String,
    pub product_id: String,
    pub transaction_id: String,
}

/// A restored purchase entry.
#[cfg(mobile)]
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IapRestoredPurchase {
    pub receipt_data: String,
    pub product_id: String,
    pub transaction_id: String,
}

/// Receipt validation request sent to the backend edge function.
#[cfg(mobile)]
#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct ValidatePurchaseRequest {
    pub provider: String,     // "apple" or "google"
    pub receipt_data: String, // purchaseToken or signedTransaction
    pub product_id: String,
}

/// Receipt validation response from the backend.
#[cfg(mobile)]
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct ValidatePurchaseResponse {
    pub success: bool,
    pub subscription_id: Option<String>,
    pub plan: Option<ValidatedPlan>,
    pub billing_interval: Option<String>,
    pub current_period_end: Option<String>,
}

#[cfg(mobile)]
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct ValidatedPlan {
    pub name: String,
    pub slug: String,
    pub max_devices: i32,
    pub bandwidth_limit_gb: Option<i32>,
    pub can_bond: bool,
    pub server_access: String,
}
