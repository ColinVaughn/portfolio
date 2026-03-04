use anyhow::{Context, Result};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use hudsucker::certificate_authority::RcgenAuthority;
use hudsucker::hyper::{Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use bytes::Bytes;
use hudsucker::{Body, HttpContext, HttpHandler, Proxy, RequestOrResponse};
use std::io::{Read, Write};
use std::net::SocketAddr;
use std::sync::Arc;

use super::engine::AdblockEngine;
use super::stats::AdblockStats;
use super::webrtc::WEBRTC_SHIELD_SCRIPT;

/// Maximum HTML body size we'll buffer for cosmetic injection (5 MB).
/// Larger HTML responses are passed through unmodified to avoid OOM.
const MAX_INJECTABLE_BODY_SIZE: usize = 5 * 1024 * 1024;

/// The MITM proxy that intercepts HTTP/HTTPS traffic, checks it against
/// the adblock engine, and injects cosmetic filters into HTML responses.
pub struct AdblockProxy {
    listen_addr: SocketAddr,
    engine: Arc<AdblockEngine>,
    stats: Arc<AdblockStats>,
    ca_cert_path: std::path::PathBuf,
    ca_key_path: std::path::PathBuf,
}

impl AdblockProxy {
    pub fn new(
        listen_addr: SocketAddr,
        engine: Arc<AdblockEngine>,
        stats: Arc<AdblockStats>,
        ca_cert_path: std::path::PathBuf,
        ca_key_path: std::path::PathBuf,
    ) -> Self {
        Self {
            listen_addr,
            engine,
            stats,
            ca_cert_path,
            ca_key_path,
        }
    }

    /// Start the MITM proxy using hudsucker with RcgenAuthority.
    pub async fn run(&self) -> Result<()> {
        let ca_cert_pem = std::fs::read_to_string(&self.ca_cert_path)
            .context("Failed to read CA certificate PEM")?;
        let ca_key_pem = std::fs::read_to_string(&self.ca_key_path)
            .context("Failed to read CA private key PEM")?;

        let ca_key = rcgen::KeyPair::from_pem(&ca_key_pem)
            .context("Failed to parse CA private key")?;
        
        let ca_cert_params = rcgen::CertificateParams::from_ca_cert_pem(&ca_cert_pem)
            .context("Failed to parse CA certificate params")?;
        let ca_cert = ca_cert_params.self_signed(&ca_key)
            .context("Failed to create CA certificate")?;

        let ca = RcgenAuthority::new(ca_key, ca_cert, 1000);

        let handler = AdblockHandler {
            engine: self.engine.clone(),
            stats: self.stats.clone(),
            request_url: None,
        };

        let proxy = Proxy::builder()
            .with_addr(self.listen_addr)
            .with_rustls_client()
            .with_ca(ca)
            .with_http_handler(handler)
            .build();

        tracing::info!(addr = %self.listen_addr, "MITM proxy started");

        proxy.start()
            .await
            .map_err(|e| anyhow::anyhow!("MITM proxy error: {e}"))
    }
}

/// The HTTP handler that inspects, blocks, and modifies traffic.
#[derive(Clone)]
struct AdblockHandler {
    engine: Arc<AdblockEngine>,
    stats: Arc<AdblockStats>,
    request_url: Option<String>,
}

impl HttpHandler for AdblockHandler {
    async fn handle_request(
        &mut self,
        _ctx: &HttpContext,
        req: Request<Body>,
    ) -> RequestOrResponse {
        let url = req.uri().to_string();
        self.request_url = Some(url.clone());

        let source_url = req
            .headers()
            .get("referer")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        let request_type = guess_request_type(&req);

        let result = self.engine.check_network_request(&url, &source_url, &request_type).await;

        if result.matched && !result.has_exception {
            let filter_desc = result.filter.clone();
            let stats = self.stats.clone();
            let url_for_log = url.clone();
            let source_for_log = source_url.clone();
            let type_for_log = request_type.clone();

            tokio::spawn(async move {
                stats
                    .record_blocked(&url_for_log, &source_for_log, &type_for_log, filter_desc, 10_000)
                    .await;
            });

            tracing::debug!(url = url.as_str(), "Request blocked by adblock engine");

            let response = build_blocked_response(&request_type);
            return RequestOrResponse::Response(response);
        }

        let stats = self.stats.clone();
        tokio::spawn(async move {
            stats.record_allowed(&url, &source_url, &request_type).await;
        });

        RequestOrResponse::Request(req)
    }

    async fn handle_response(
        &mut self,
        _ctx: &HttpContext,
        res: Response<Body>,
    ) -> Response<Body> {
        // Only inject cosmetic filters into HTML responses
        let is_html = res
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .map(|ct| ct.contains("text/html"))
            .unwrap_or(false);

        if !is_html {
            return res;
        }

        // Determine the URL for cosmetic filter lookup from the response
        // We use the Host header or fall back to an empty string
        let url_for_cosmetics = self.request_url.clone().unwrap_or_default();

        // Get cosmetic filters for this URL
        let cosmetics = self.engine.get_cosmetic_filters(&url_for_cosmetics).await;

        // If no cosmetic filters apply, pass through unmodified
        if cosmetics.hide_selectors.is_empty()
            && cosmetics.style_selectors.is_empty()
            && cosmetics.injected_script.is_empty()
        {
            return res;
        }

        // Decompose the response
        let (mut parts, body) = res.into_parts();

        // Read the body bytes
        let body_bytes = match body.collect().await {
            Ok(collected) => collected.to_bytes().to_vec(),
            Err(e) => {
                tracing::warn!(error = %e, "Failed to read HTML response body for cosmetic injection");
                return Response::from_parts(parts, Body::from(Full::new(Bytes::new())));
            }
        };

        // Skip injection for bodies that are too large
        if body_bytes.len() > MAX_INJECTABLE_BODY_SIZE {
            tracing::debug!("HTML body too large for cosmetic injection, passing through");
            return Response::from_parts(parts, Body::from(Full::new(Bytes::from(body_bytes))));
        }

        // Detect and handle content encoding (gzip, brotli, or identity)
        let content_encoding = parts
            .headers
            .get("content-encoding")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();

        let decompressed = match decompress_body(&body_bytes, &content_encoding) {
            Ok(bytes) => bytes,
            Err(e) => {
                tracing::warn!(error = %e, "Failed to decompress HTML body, passing through");
                return Response::from_parts(parts, Body::from(Full::new(Bytes::from(body_bytes))));
            }
        };

        // Convert to string for modification
        let html = match String::from_utf8(decompressed) {
            Ok(s) => s,
            Err(_) => {
                tracing::debug!("HTML body is not valid UTF-8, passing through");
                return Response::from_parts(parts, Body::from(Full::new(Bytes::from(body_bytes))));
            }
        };

        // Inject cosmetic filters into the HTML
        let modified_html = inject_cosmetic_filters(&html, &cosmetics);

        // Re-compress if the original was compressed
        let output_bytes = match recompress_body(modified_html.as_bytes(), &content_encoding) {
            Ok(bytes) => bytes,
            Err(e) => {
                tracing::warn!(error = %e, "Failed to recompress HTML body");
                // Fall back to sending uncompressed and removing the encoding header
                parts.headers.remove("content-encoding");
                modified_html.into_bytes()
            }
        };

        // Update content-length to match modified body
        parts.headers.remove("content-length");
        parts.headers.insert(
            "content-length",
            hyper::header::HeaderValue::from_str(&output_bytes.len().to_string())
                .unwrap_or_else(|_| hyper::header::HeaderValue::from_static("0")),
        );

        // Remove transfer-encoding: chunked since we've buffered the whole body
        parts.headers.remove("transfer-encoding");

        tracing::debug!(
            url = %url_for_cosmetics,
            hide_selectors = cosmetics.hide_selectors.len(),
            style_rules = cosmetics.style_selectors.len(),
            has_scriptlet = !cosmetics.injected_script.is_empty(),
            "Injected cosmetic filters into HTML response"
        );

        Response::from_parts(parts, Body::from(Full::new(Bytes::from(output_bytes))))
    }
}

/// Decompress a response body based on the Content-Encoding header.
fn decompress_body(data: &[u8], encoding: &str) -> Result<Vec<u8>> {
    match encoding {
        "gzip" | "x-gzip" => {
            let mut decoder = GzDecoder::new(data);
            let mut decompressed = Vec::new();
            decoder.read_to_end(&mut decompressed)
                .context("Failed to decompress gzip body")?;
            Ok(decompressed)
        }
        "br" => {
            let mut decompressed = Vec::new();
            let mut decoder = brotli::Decompressor::new(data, 4096);
            decoder.read_to_end(&mut decompressed)
                .context("Failed to decompress brotli body")?;
            Ok(decompressed)
        }
        "deflate" => {
            let mut decoder = flate2::read::DeflateDecoder::new(data);
            let mut decompressed = Vec::new();
            decoder.read_to_end(&mut decompressed)
                .context("Failed to decompress deflate body")?;
            Ok(decompressed)
        }
        "" | "identity" => {
            // No compression
            Ok(data.to_vec())
        }
        other => {
            anyhow::bail!("Unsupported content encoding: {other}")
        }
    }
}

/// Recompress a body using the same encoding as the original response.
fn recompress_body(data: &[u8], encoding: &str) -> Result<Vec<u8>> {
    match encoding {
        "gzip" | "x-gzip" => {
            let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
            encoder.write_all(data)
                .context("Failed to gzip compress body")?;
            encoder.finish().context("Failed to finish gzip compression")
        }
        "br" => {
            let mut compressed = Vec::new();
            {
                let mut encoder = brotli::CompressorWriter::new(&mut compressed, 4096, 4, 22);
                encoder.write_all(data)
                    .context("Failed to brotli compress body")?;
                // CompressorWriter flushes on drop
            }
            Ok(compressed)
        }
        "deflate" => {
            let mut encoder = flate2::write::DeflateEncoder::new(Vec::new(), Compression::fast());
            encoder.write_all(data)
                .context("Failed to deflate compress body")?;
            encoder.finish().context("Failed to finish deflate compression")
        }
        "" | "identity" => {
            Ok(data.to_vec())
        }
        other => {
            anyhow::bail!("Unsupported content encoding for recompression: {other}")
        }
    }
}

/// Inject cosmetic CSS selectors and scriptlets into an HTML document.
///
/// Performs three types of injection:
/// 1. **Hide selectors**  - CSS rules with `display: none !important` injected before `</head>`
/// 2. **Style selectors**  - Custom CSS property rules injected before `</head>`
/// 3. **Scriptlets**  - Anti-adblock bypass JavaScript injected after `<head>` (runs first)
fn inject_cosmetic_filters(
    html: &str,
    cosmetics: &super::engine::CosmeticResult,
) -> String {
    let mut modified = html.to_string();

    // 1. Build CSS for hiding selectors
    let mut css_rules = String::new();

    if !cosmetics.hide_selectors.is_empty() {
        // Batch all hide selectors into a single rule for performance
        let selector_list = cosmetics
            .hide_selectors
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join(",\n");

        css_rules.push_str(&format!(
            "{} {{ display: none !important; }}\n",
            selector_list
        ));
    }

    // 2. Add style selectors (custom CSS properties)
    for (selector, properties) in &cosmetics.style_selectors {
        let props = properties.join("; ");
        css_rules.push_str(&format!("{} {{ {} !important; }}\n", selector, props));
    }

    // 3. Inject CSS before </head> (case-insensitive search)
    if !css_rules.is_empty() {
        let style_tag = format!(
            "\n<style id=\"tunnely-cosmetic\">\n{}</style>\n",
            css_rules
        );

        if let Some(pos) = find_case_insensitive(&modified, "</head>") {
            modified.insert_str(pos, &style_tag);
        } else if let Some(pos) = find_case_insensitive(&modified, "<body") {
            // Fallback: inject before <body> if </head> not found
            modified.insert_str(pos, &style_tag);
        } else {
            // Last resort: prepend to document
            modified.insert_str(0, &style_tag);
        }
    }

    // 4. Inject WebRTC leak prevention shield (always active, not subscription-gated)
    {
        let webrtc_tag = format!(
            "\n<script id=\"tunnely-webrtc-shield\">{}</script>\n",
            WEBRTC_SHIELD_SCRIPT
        );

        if let Some(head_pos) = find_case_insensitive(&modified, "<head>") {
            modified.insert_str(head_pos + 6, &webrtc_tag);
        } else if let Some(head_pos) = find_case_insensitive(&modified, "<head ") {
            if let Some(close_bracket) = modified[head_pos..].find('>') {
                modified.insert_str(head_pos + close_bracket + 1, &webrtc_tag);
            }
        } else {
            modified.insert_str(0, &webrtc_tag);
        }
    }

    // 5. Inject scriptlets after <head> (anti-adblock bypass, property stubs, etc.)
    if !cosmetics.injected_script.is_empty() {
        let script_tag = format!(
            "\n<script id=\"tunnely-scriptlet\">{}</script>\n",
            cosmetics.injected_script
        );

        // Scriptlets must run before page scripts, so inject right after <head>
        if let Some(head_pos) = find_case_insensitive(&modified, "<head>") {
            modified.insert_str(head_pos + 6, &script_tag);
        } else if let Some(head_pos) = find_case_insensitive(&modified, "<head ") {
            // <head> tag might have attributes like <head data-foo="bar">
            if let Some(close_bracket) = modified[head_pos..].find('>') {
                modified.insert_str(head_pos + close_bracket + 1, &script_tag);
            }
        } else {
            // No <head> tag found  - prepend to document
            modified.insert_str(0, &script_tag);
        }
    }

    modified
}

/// Case-insensitive substring search. Returns the byte offset of the first match.
fn find_case_insensitive(haystack: &str, needle: &str) -> Option<usize> {
    let haystack_lower = haystack.to_lowercase();
    let needle_lower = needle.to_lowercase();
    haystack_lower.find(&needle_lower)
}

/// Guess the resource type from HTTP request headers.
fn guess_request_type<T>(req: &Request<T>) -> String {
    // Check Sec-Fetch-Dest header (modern browsers  - most reliable)
    if let Some(dest) = req.headers().get("sec-fetch-dest").and_then(|v| v.to_str().ok()) {
        return match dest {
            "document" => "document",
            "script" => "script",
            "style" => "stylesheet",
            "image" => "image",
            "font" => "font",
            "empty" | "fetch" => "xmlhttprequest",
            "iframe" => "subdocument",
            "video" | "audio" => "media",
            "worker" | "sharedworker" | "serviceworker" => "other",
            other => other,
        }
        .to_string();
    }

    // Check Accept header
    if let Some(accept) = req.headers().get("accept").and_then(|v| v.to_str().ok()) {
        if accept.contains("text/html") {
            return "document".to_string();
        }
        if accept.contains("text/css") {
            return "stylesheet".to_string();
        }
        if accept.contains("image/") {
            return "image".to_string();
        }
        if accept.contains("application/javascript") || accept.contains("text/javascript") {
            return "script".to_string();
        }
        if accept.contains("font/") || accept.contains("application/font") {
            return "font".to_string();
        }
        if accept.contains("application/json") || accept.contains("text/xml") {
            return "xmlhttprequest".to_string();
        }
    }

    // Guess from URL extension
    let path = req.uri().path();
    if let Some(ext) = path.rsplit('.').next() {
        return match ext.to_lowercase().as_str() {
            "js" | "mjs" => "script",
            "css" => "stylesheet",
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico" | "avif" => "image",
            "woff" | "woff2" | "ttf" | "otf" | "eot" => "font",
            "mp4" | "webm" | "ogg" | "mp3" | "m4a" | "flac" => "media",
            "html" | "htm" => "document",
            "json" | "xml" => "xmlhttprequest",
            _ => "other",
        }
        .to_string();
    }

    "other".to_string()
}

/// Build a minimal response for blocked requests.
fn build_blocked_response(request_type: &str) -> Response<Body> {
    match request_type {
        "image" => {
            // Transparent 1x1 GIF
            let pixel: &[u8] = &[
                0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
                0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00,
                0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
                0x44, 0x01, 0x00, 0x3B,
            ];

            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", "image/gif")
                .header("content-length", pixel.len().to_string())
                .header("cache-control", "no-cache")
                .body(Body::from(Full::new(Bytes::from_static(pixel))))
                .unwrap_or_else(|_| Response::new(Body::empty()))
        }
        "script" => {
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", "application/javascript")
                .header("content-length", "0")
                .header("cache-control", "no-cache")
                .body(Body::empty())
                .unwrap_or_else(|_| Response::new(Body::empty()))
        }
        "stylesheet" => {
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", "text/css")
                .header("content-length", "0")
                .header("cache-control", "no-cache")
                .body(Body::empty())
                .unwrap_or_else(|_| Response::new(Body::empty()))
        }
        _ => {
            Response::builder()
                .status(StatusCode::NO_CONTENT)
                .header("cache-control", "no-cache")
                .body(Body::empty())
                .unwrap_or_else(|_| Response::new(Body::empty()))
        }
    }
}
