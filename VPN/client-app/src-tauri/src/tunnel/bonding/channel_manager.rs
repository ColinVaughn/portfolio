use std::net::{IpAddr, SocketAddr};
use tokio::net::UdpSocket;
use relay_common::bonding::InterfaceType;
use crate::tunnel::bonding::channel::Channel;

pub struct ChannelManager {
    channels: std::collections::HashMap<u16, Channel>,
    next_id: u16,
    endpoint: SocketAddr,
}

impl ChannelManager {
    pub fn new(endpoint: SocketAddr) -> Self {
        Self {
            channels: std::collections::HashMap::new(),
            next_id: 1,
            endpoint,
        }
    }

    pub fn discover_interfaces(&self) -> Vec<if_addrs::Interface> {
        let interfaces = if_addrs::get_if_addrs().unwrap_or_default();
        interfaces.into_iter().filter(|i| {
            !i.is_loopback() && 
            !i.name.starts_with("utun") && 
            !i.name.starts_with("tun") &&
            !i.name.starts_with("wg") &&
            !i.name.to_lowercase().contains("wintun")
        }).collect()
    }

    pub fn classify_interface(name: &str) -> InterfaceType {
        let lower = name.to_lowercase();
        if lower.starts_with("en") || lower.starts_with("eth") {
            InterfaceType::Ethernet
        } else if lower.starts_with("wl") || lower.starts_with("wi-fi") {
            InterfaceType::WiFi
        } else if lower.starts_with("ww") || lower.starts_with("rmnet") {
            InterfaceType::Cellular
        } else {
            InterfaceType::Unknown
        }
    }

    /// Create a bonding channel bound to a specific network interface.
    ///
    /// Uses platform-specific socket options to FORCE traffic through
    /// the named interface, not just bind to its IP:
    ///
    /// - **Linux**: `SO_BINDTODEVICE`  - pins socket to interface by name
    /// - **macOS**: `IP_BOUND_IF`  - pins socket to interface by index
    /// - **Windows**: Bind-to-IP is sufficient; Windows respects source routing
    pub async fn create_channel_for_interface(&mut self, addr: IpAddr, name: String) -> anyhow::Result<u16> {
        use socket2::{Socket, Domain, Type, Protocol};

        let domain = match addr {
            IpAddr::V4(_) => Domain::IPV4,
            IpAddr::V6(_) => Domain::IPV6,
        };

        // Create raw socket via socket2 so we can set platform options
        let raw_socket = Socket::new(domain, Type::DGRAM, Some(Protocol::UDP))?;
        raw_socket.set_nonblocking(true)?;
        raw_socket.set_reuse_address(true)?;

        // Bind to the interface's local IP
        let bind_addr: socket2::SockAddr = SocketAddr::new(addr, 0).into();
        raw_socket.bind(&bind_addr)?;

        // Platform-specific: force traffic through THIS interface
        self.bind_to_device(&raw_socket, &name)?;

        // Convert socket2 → std → tokio
        let std_socket: std::net::UdpSocket = raw_socket.into();
        let socket = UdpSocket::from_std(std_socket)?;
        socket.connect(self.endpoint).await?;
        
        let c_type = Self::classify_interface(&name);
        let id = self.next_id;
        self.next_id += 1;
        
        tracing::info!(
            interface = %name,
            ip = %addr,
            channel_id = id,
            "Bonding channel created with interface pinning"
        );

        let channel = Channel::new(id, name, c_type, socket);
        self.channels.insert(id, channel);
        
        Ok(id)
    }

    /// Platform-specific socket-to-interface binding.
    #[cfg(target_os = "linux")]
    fn bind_to_device(&self, socket: &socket2::Socket, interface_name: &str) -> anyhow::Result<()> {
        // SO_BINDTODEVICE forces all traffic through the named interface.
        // Requires CAP_NET_RAW or root.
        socket.bind_device(Some(interface_name.as_bytes()))?;
        tracing::debug!(interface = %interface_name, "Linux: SO_BINDTODEVICE applied");
        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn bind_to_device(&self, socket: &socket2::Socket, interface_name: &str) -> anyhow::Result<()> {
        // IP_BOUND_IF uses the interface index to pin the socket.
        use std::os::unix::io::AsRawFd;
        let if_index = unsafe {
            libc::if_nametoindex(
                std::ffi::CString::new(interface_name)?.as_ptr()
            )
        };
        if if_index == 0 {
            return Err(anyhow::anyhow!(
                "Failed to resolve interface index for '{}'", interface_name
            ));
        }
        // IP_BOUND_IF = 25 on macOS
        let ret = unsafe {
            libc::setsockopt(
                socket.as_raw_fd(),
                libc::IPPROTO_IP,
                25, // IP_BOUND_IF
                &if_index as *const u32 as *const libc::c_void,
                std::mem::size_of::<u32>() as libc::socklen_t,
            )
        };
        if ret != 0 {
            return Err(anyhow::anyhow!(
                "Failed to set IP_BOUND_IF for '{}': {}",
                interface_name,
                std::io::Error::last_os_error()
            ));
        }
        tracing::debug!(interface = %interface_name, index = if_index, "macOS: IP_BOUND_IF applied");
        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn bind_to_device(&self, _socket: &socket2::Socket, interface_name: &str) -> anyhow::Result<()> {
        // Windows: binding to the local IP is sufficient for interface pinning.
        // The OS respects source-IP → interface mapping for outgoing packets.
        tracing::debug!(interface = %interface_name, "Windows: bind-to-IP used (native routing)");
        Ok(())
    }

    // Fallback for other platforms
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    fn bind_to_device(&self, _socket: &socket2::Socket, interface_name: &str) -> anyhow::Result<()> {
        tracing::warn!(interface = %interface_name, "No platform-specific interface binding available, using IP bind only");
        Ok(())
    }

    pub fn get_channel(&self, id: u16) -> Option<&Channel> {
        self.channels.get(&id)
    }

    pub fn get_channel_mut(&mut self, id: u16) -> Option<&mut Channel> {
        self.channels.get_mut(&id)
    }
    
    pub fn get_all_channels(&self) -> Vec<&Channel> {
        self.channels.values().collect()
    }

    pub fn get_all_channels_mut(&mut self) -> Vec<&mut Channel> {
        self.channels.values_mut().collect()
    }
}
