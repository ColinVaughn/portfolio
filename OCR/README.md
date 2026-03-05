# OCR Document Scanner

Browser-based OCR document scanner with structured data extraction and fraud detection. Skills demo recreating a receipt scanning pipeline from past contracted work.

**Demo:** [colinvaughn.xyz/OCR](https://colinvaughn.xyz/OCR/)

## Features

- **Document type auto-detection** - fuel receipts, retail receipts, invoices, and general documents
- **Structured data extraction** - key-value parsing with regex fallbacks for edge cases
- **Image preprocessing** - upscale, grayscale, median denoise, contrast normalization, and adaptive thresholding via Web Worker
- **Fraud detection** - six heuristic checks flagging price outliers, math mismatches, duplicates, and more
- **Word-level confidence** - color-coded OCR output showing per-word recognition quality
- **Sample images** - canvas-generated sample documents for quick demo without needing real receipts

## Stack

| Technology   | Role                                  |
| ------------ | ------------------------------------- |
| Tesseract.js | OCR engine (WASM build, v5)           |
| Web Workers  | Image preprocessing off main thread   |
| Canvas API   | Image preprocessing pipeline          |
| JavaScript   | Application logic and data extraction |
| HTML / CSS   | UI and styling                        |

## Files

```
OCR/
├── index.html               Page and UI
├── style.css                 Project-specific styles
├── app.js                    OCR engine, extraction, fraud detection
├── samples.js                Canvas-generated sample receipt images
└── preprocessor.worker.js    Image preprocessing Web Worker
```

## License

All Rights Reserved. This source code is provided for portfolio review purposes only. You may not copy, modify, distribute, or use any part of this code without explicit written permission.
