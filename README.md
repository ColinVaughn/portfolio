# Colin Vaughn - Portfolio

Personal portfolio site and project showcase.

**Live:** [colinvaughn.xyz](https://colinvaughn.xyz)

## Structure

```
/                   Portfolio site (HTML/CSS)
/VPN/               Tunnely - VPN platform source code
/Omni/              Omni - AI agent platform source code
/OCR/               OCR Document Scanner - live browser demo
/FaceDetection/     Face Detection - live browser demo
```

## Projects

### Tunnely (VPN)

Privacy-first VPN platform built in Rust. WireGuard encryption, multi-relay mesh networking, channel bonding, QUIC obfuscation, and network-level ad/tracker blocking. Shipped as a Tauri desktop app with a Next.js marketing site and Supabase backend.

**Stack:** Rust, Tauri, Solid.js, TypeScript, WireGuard, Docker, Next.js, Supabase, Stripe

**Source:** [github.com/ColinVaughn/portfolio/tree/main/VPN](https://github.com/ColinVaughn/portfolio/tree/main/VPN)

| Component      | Path                |
| -------------- | ------------------- |
| Desktop Client | `VPN/client-app/`   |
| Relay Server   | `VPN/relay-server/` |
| Marketing Site | `VPN/website/`      |

> **License:** Tunnely is closed source. All Rights Reserved. The source code in `VPN/` is provided for portfolio review purposes only. You may not copy, modify, distribute, or use any part of the Tunnely codebase without explicit written permission.

### Omni

Open-source AI agent platform. 9-crate Rust workspace with Tauri + React desktop UI, WASM-sandboxed extensions, and multi-provider LLM orchestration.

**Source:** [github.com/Omni-App-AI/Omni](https://github.com/Omni-App-AI/Omni)

**License:** GPL

### A11yCore (Coming Soon)

Accessibility compliance SaaS with real-time WCAG 2.2 scanning and a 14 KB remediation plugin. 10,000+ scans across 500+ users.

**License:** All Rights Reserved

### BattleforgePC (Coming Soon)

E-commerce platform for custom PC hardware with React, Supabase, Stripe, and ChatGPT-powered build recommendations. Largest seller on TikTok Shop in category.

**License:** All Rights Reserved

### OCR Document Scanner

Skills demo recreating a receipt scanning pipeline from past contracted work. The original system is closed-source per contract terms. Auto-detects document types (fuel receipts, retail receipts, invoices), extracts structured data, and runs fraud detection heuristics. Runs entirely client-side with image preprocessing via Web Workers.

**Stack:** JavaScript, Tesseract.js, Web Workers, WASM, HTML/CSS

**Demo:** [colinvaughn.xyz/OCR](https://colinvaughn.xyz/OCR/)

> **License:** All Rights Reserved. The source code in `OCR/` is provided for portfolio review purposes only.

### Face Detection

Skills demo recreating a real-time face detection pipeline from past contracted work. The original system is closed-source per contract terms. Uses webcam feed with bounding box rendering and confidence scoring at 30+ FPS. Runs entirely client-side.

**Stack:** JavaScript, face-api.js, TensorFlow.js, WebRTC, Canvas, HTML/CSS

**Demo:** [colinvaughn.xyz/FaceDetection](https://colinvaughn.xyz/FaceDetection/)

> **License:** All Rights Reserved. The source code in `FaceDetection/` is provided for portfolio review purposes only.

## Contact

- **Email:** colin@colinvaughn.xyz
- **LinkedIn:** [linkedin.com/in/colin-vaughn](https://linkedin.com/in/colin-vaughn)
- **GitHub:** [github.com/colinvaughn](https://github.com/colinvaughn)
- **Website:** [colinvaughn.xyz](https://colinvaughn.xyz)
