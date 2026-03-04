# ============================================================
# Multi-stage build for VPN Relay Server
# ============================================================

# Stage 1: Build
FROM rust:1.83-bookworm AS builder

WORKDIR /build

# Copy workspace manifests first for dependency caching
COPY relay-server/Cargo.toml relay-server/Cargo.lock ./relay-server/
COPY relay-server/relay-core/Cargo.toml ./relay-server/relay-core/
COPY relay-server/relay-common/Cargo.toml ./relay-server/relay-common/
COPY relay-server/relay-quic/Cargo.toml ./relay-server/relay-quic/

# Create dummy source files to cache dependencies
RUN mkdir -p relay-server/relay-core/src \
    relay-server/relay-common/src \
    relay-server/relay-quic/src && \
    echo "fn main() {}" > relay-server/relay-core/src/main.rs && \
    echo "pub fn stub() {}" > relay-server/relay-common/src/lib.rs && \
    echo "pub fn stub() {}" > relay-server/relay-quic/src/lib.rs

# Build dependencies only (cached layer)
RUN cd relay-server && cargo build --release 2>/dev/null || true

# Copy actual source code
COPY relay-server/ ./relay-server/

# Touch source files to invalidate the dummy build
RUN touch relay-server/relay-core/src/main.rs \
    relay-server/relay-common/src/lib.rs \
    relay-server/relay-quic/src/lib.rs

# Full build
RUN cd relay-server && cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wireguard-tools \
    nftables \
    iproute2 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /etc/relay/keys /etc/relay/tls /etc/relay/blocklists /opt/relay

# Copy binary
COPY --from=builder /build/relay-server/target/release/relay-core /opt/relay/relay-core

# Copy scripts
COPY scripts/update-blocklists.sh /opt/relay/update-blocklists.sh
RUN chmod +x /opt/relay/update-blocklists.sh

# Download initial blocklists during build
RUN /opt/relay/update-blocklists.sh /etc/relay/blocklists || true

# Copy default env
COPY .env.example /etc/relay/relay.env

EXPOSE 51820/udp 51821/udp 443/udp 8080/tcp 8081/tcp

# Capabilities needed for WireGuard and networking
# Must run with --cap-add=NET_ADMIN --cap-add=NET_RAW

ENTRYPOINT ["/opt/relay/relay-core"]
