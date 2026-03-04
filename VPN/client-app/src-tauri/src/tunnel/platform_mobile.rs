/// Mobile platform TUN device abstraction.
///
/// On mobile, the TUN device is created by the native VPN service
/// (Android VpnService / iOS NEPacketTunnelProvider) and a raw file
/// descriptor is passed to Rust. This module wraps that fd into an
/// async-compatible reader/writer that `boringtun` can use.
///
/// This module is only compiled on mobile targets (`#[cfg(mobile)]`).

#[cfg(target_os = "android")]
use std::os::unix::io::RawFd;

/// A TUN device backed by a raw file descriptor from the native VPN service.
pub struct MobileTunDevice {
    /// The raw file descriptor for the TUN device
    fd: i64,
    /// Async file wrapper for read/write
    #[cfg(target_os = "android")]
    file: tokio::fs::File,
}

impl MobileTunDevice {
    /// Wrap a raw file descriptor from the native VPN service into a
    /// `MobileTunDevice` suitable for async I/O.
    ///
    /// # Safety
    /// The caller must ensure `fd` is a valid, open TUN file descriptor
    /// obtained from the native VPN service.
    pub fn from_fd(fd: i64) -> std::io::Result<Self> {
        #[cfg(target_os = "android")]
        {
            use std::os::unix::io::FromRawFd;
            // SAFETY: The fd comes from Android's VpnService.Builder.establish()
            // which returns a valid ParcelFileDescriptor.
            let std_file = unsafe { std::fs::File::from_raw_fd(fd as RawFd) };
            let tokio_file = tokio::fs::File::from_std(std_file);
            Ok(Self {
                fd,
                file: tokio_file,
            })
        }

        #[cfg(target_os = "ios")]
        {
            // iOS uses NEPacketTunnelProvider.packetFlow instead of a raw fd,
            // so we just store the fd value and skip the tokio wrapper.
            Ok(Self { fd })
        }

        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            // This module should only compile on mobile, but provide a
            // fallback to avoid cfg confusion during development.
            Err(std::io::Error::new(
                std::io::ErrorKind::Unsupported,
                "MobileTunDevice is only available on Android/iOS",
            ))
        }
    }

    /// Read a packet from the TUN device.
    pub async fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        #[cfg(target_os = "android")]
        {
            use tokio::io::AsyncReadExt;
            self.file.read(buf).await
        }

        #[cfg(not(target_os = "android"))]
        {
            // iOS: needs NEPacketTunnelProvider.packetFlow bridged via FFI
            Err(std::io::Error::new(
                std::io::ErrorKind::Unsupported,
                "TUN read not yet implemented on this platform",
            ))
        }
    }

    /// Write a packet to the TUN device.
    pub async fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
        #[cfg(target_os = "android")]
        {
            use tokio::io::AsyncWriteExt;
            self.file.write_all(data).await
        }

        #[cfg(not(target_os = "android"))]
        {
            // iOS: needs NEPacketTunnelProvider.packetFlow bridged via FFI
            Err(std::io::Error::new(
                std::io::ErrorKind::Unsupported,
                "TUN write not yet implemented on this platform",
            ))
        }
    }

    /// Get the raw file descriptor.
    pub fn fd(&self) -> i64 {
        self.fd
    }
}

impl Drop for MobileTunDevice {
    fn drop(&mut self) {
        // On Android, closing the fd is handled by the VpnService when
        // we call stopVpn(). We do NOT close it here because the fd
        // ownership belongs to the ParcelFileDescriptor on the Java side.
        //
        // On iOS, the packetFlow is managed by the NEPacketTunnelProvider.
        tracing::debug!(fd = self.fd, "MobileTunDevice dropped (fd not closed  - owned by native)");
    }
}
