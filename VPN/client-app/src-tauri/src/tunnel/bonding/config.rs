/// Bonding configuration for the client tunnel.
#[allow(dead_code)]
pub struct BondingConfig {
    pub enabled: bool,
    pub mode: relay_common::bonding::BondingMode,
    pub bonding_port: u16,
}

impl Default for BondingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: relay_common::bonding::BondingMode::Speed,
            bonding_port: 51830,
        }
    }
}
