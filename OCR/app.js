/**
 * OCR Document Scanner
 * Browser-based document scanning with Tesseract.js
 * Supports fuel receipts, retail receipts, invoices, and general documents
 * Features: image preprocessing, word-level confidence, fraud detection
 */

// DOM refs
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressPct = document.getElementById('progressPct');
const progressLabel = document.getElementById('progressLabel');
const resultsSection = document.getElementById('resultsSection');
const previewImg = document.getElementById('previewImg');
const preprocessedImg = document.getElementById('preprocessedImg');
const rawTextOutput = document.getElementById('rawTextOutput');
const extractedTable = document.getElementById('extractedTable');
const fraudAlerts = document.getElementById('fraudAlerts');
const btnExport = document.getElementById('btnExport');
const btnReset = document.getElementById('btnReset');
const preprocessToggle = document.getElementById('preprocessToggle');
const previewOrigTab = document.getElementById('previewOrigTab');
const previewPrepTab = document.getElementById('previewPrepTab');
const docTypeBadge = document.getElementById('docTypeBadge');
const ocrConfidenceBar = document.getElementById('ocrConfidenceBar');
const ocrConfidenceVal = document.getElementById('ocrConfidenceVal');
const ocrConfidenceFill = document.getElementById('ocrConfidenceFill');

// State
let lastResult = null;
let isProcessing = false;

// Image Preprocessing Pipeline
// Pipeline for Tesseract OCR input:
//   - Upscale small images (Tesseract needs ~30px cap height / 300 DPI)
//   - Grayscale conversion (weighted luminance)
//   - Noise reduction (3x3 median filter, edge-preserving)
//   - Contrast normalization (histogram stretch with 2% clip)
//   - Adaptive thresholding (local mean, handles uneven lighting)

function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(fileUrl);

      // Upscale small images
      // Tesseract needs ~300 DPI. For standard receipts, width should be at least ~1000-1200px.
      let targetW = img.width;
      let targetH = img.height;
      const MIN_WIDTH = 1200;

      if (img.width < MIN_WIDTH) {
        const scale = Math.min(MIN_WIDTH / img.width, 3); // Cap at 3x
        targetW = Math.round(img.width * scale);
        targetH = Math.round(img.height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);

      // Offload heavy image processing to Web Worker
      const worker = new Worker('preprocessor.worker.js');
      
      worker.onmessage = (e) => {
        const { processedData } = e.data;
        ctx.putImageData(processedData, 0, 0);
        
        canvas.toBlob((blob) => {
          const previewUrl = URL.createObjectURL(blob);
          resolve({ blob, previewUrl });
        }, 'image/png');
        
        worker.terminate();
      };

      worker.onerror = (err) => {
        console.error('Preprocessor Worker Error:', err);
        worker.terminate();
        reject(err);
      };

      worker.postMessage({ imageData, width: w, height: h });
    };

    const fileUrl = URL.createObjectURL(file);
    img.onerror = () => {
      URL.revokeObjectURL(fileUrl);
      reject(new Error('Failed to load image for preprocessing'));
    };
    img.src = fileUrl;
  });
}


// ============================================================
// Upload Handlers
// ============================================================

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    processFile(file);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processFile(file);
});

// Sample image handlers
document.querySelectorAll('.sample-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (isProcessing) return;
    const type = btn.dataset.sample;
    btn.disabled = true;
    btn.querySelector('.sample-btn-label').textContent = 'Generating...';

    let blob;
    if (type === 'fuel') blob = await SampleReceipts.generateFuelReceipt();
    else if (type === 'retail') blob = await SampleReceipts.generateRetailReceipt();
    else if (type === 'invoice') blob = await SampleReceipts.generateInvoice();

    btn.disabled = false;
    const labels = { fuel: 'Gas Receipt', retail: 'Retail Receipt', invoice: 'Invoice' };
    btn.querySelector('.sample-btn-label').textContent = labels[type];

    if (blob) {
      const file = new File([blob], `sample-${type}.png`, { type: 'image/png' });
      processFile(file);
    }
  });
});

// ============================================================
// Main Processing Pipeline
// ============================================================

async function processFile(file) {
  if (isProcessing) return;
  isProcessing = true;

  // Show original preview
  const url = URL.createObjectURL(file);
  previewImg.onload = () => URL.revokeObjectURL(url);
  previewImg.src = url;
  previewImg.style.display = 'block';
  if (preprocessedImg) preprocessedImg.style.display = 'none';

  // Reset preview tabs
  if (previewOrigTab) previewOrigTab.classList.add('active');
  if (previewPrepTab) previewPrepTab.classList.remove('active');

  // Show progress
  progressSection.classList.add('active');
  resultsSection.classList.remove('active');
  updateProgress(0, 'Initializing OCR pipeline...');

  try {
    // Preprocessing
    let ocrInput = file;
    const usePreprocessing = preprocessToggle && preprocessToggle.checked;

    if (usePreprocessing) {
      updateProgress(5, 'Preprocessing image...');
      const preprocessed = await preprocessImage(file);
      ocrInput = preprocessed.blob;

      // Store preprocessed preview (don't show yet - user clicks 'Preprocessed' tab)
      if (preprocessedImg) {
        preprocessedImg.src = preprocessed.previewUrl;
        preprocessedImg.style.display = 'none';
      }
    }

    updateProgress(10, 'Initializing Tesseract worker...');

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = 15 + Math.round(m.progress * 80);
          updateProgress(pct, 'Recognizing text...');
        } else if (m.status === 'loading language traineddata') {
          updateProgress(12, 'Loading OCR language model...');
        } else if (m.status === 'initializing api') {
          updateProgress(8, 'Initializing OCR engine...');
        }
      }
    });

    const { data } = await worker.recognize(ocrInput);
    const rawText = data.text;
    const words = data.words || [];

    await worker.terminate();

    updateProgress(98, 'Analyzing document...');

    // Detect document type
    const docType = detectDocumentType(rawText);

    // Extract structured data based on document type
    const extracted = extractDocumentData(rawText, docType);

    // Run fraud/validation checks
    const alerts = runFraudDetection(extracted, rawText, docType);

    // Compute word-level confidence
    const avgConfidence = words.length > 0
      ? Math.round(words.reduce((s, w) => s + w.confidence, 0) / words.length)
      : null;

    // Store result
    lastResult = {
      rawText, extracted, alerts, words,
      docType, avgConfidence,
      fileName: file.name,
      timestamp: new Date().toISOString(),
      preprocessed: usePreprocessing
    };

    updateProgress(100, 'Processing complete');

    // Render results
    renderResults(rawText, extracted, alerts, words, docType, avgConfidence);

  } catch (err) {
    console.error('OCR Error:', err);
    updateProgress(0, 'Error: ' + err.message);
  } finally {
    isProcessing = false;
  }
}

// Preview tab switching
if (previewOrigTab) {
  previewOrigTab.addEventListener('click', () => {
    previewOrigTab.classList.add('active');
    previewPrepTab.classList.remove('active');
    previewImg.style.display = 'block';
    if (preprocessedImg) preprocessedImg.style.display = 'none';
  });
}
if (previewPrepTab) {
  previewPrepTab.addEventListener('click', () => {
    if (!preprocessedImg || !preprocessedImg.src) return;
    previewPrepTab.classList.add('active');
    previewOrigTab.classList.remove('active');
    previewImg.style.display = 'none';
    preprocessedImg.style.display = 'block';
  });
}

// Progress UI
function updateProgress(pct, label) {
  progressFill.style.width = pct + '%';
  progressPct.textContent = pct + '%';
  progressLabel.textContent = label;
}

// ============================================================
// Document Type Detection
// ============================================================

const DOC_SIGNATURES = {
  fuel: ['PUMP', 'GALLONS', 'GALLON', 'GAL', 'FUEL', 'UNLEADED', 'DIESEL', 'PREMIUM', 'REGULAR', 'PRICE/G', 'PPG', 'OCTANE'],
  retail: ['SUBTOTAL', 'ITEMS SOLD', 'QTY', 'SKU', 'GROCERY', 'MARKET', 'STORE'],
  invoice: ['INVOICE', 'BILL TO', 'DUE DATE', 'PO NUMBER', 'PO #', 'NET 30', 'NET 15', 'PAYMENT TERMS']
};

function detectDocumentType(text) {
  const upper = text.toUpperCase();
  const scores = {};

  for (const [type, keywords] of Object.entries(DOC_SIGNATURES)) {
    scores[type] = keywords.reduce((count, kw) => count + (upper.includes(kw) ? 1 : 0), 0);
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] >= 2) return best[0];
  return 'general';
}

// ============================================================
// Key-Value Parser (shared)
// ============================================================

function parseKeyValuePairs(text) {
  const kvMap = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const kvMatch = line.match(/^([A-Za-z/#\s]{2,30}?)\s*[:=]\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim().toUpperCase().replace(/\s+/g, ' ');
      const value = kvMatch[2].trim();
      kvMap[key] = value;
    }
  }
  return kvMap;
}

function extractFromKV(kvPairs, keys) {
  for (const key of keys) {
    if (kvPairs[key]) return kvPairs[key];
  }
  return null;
}

// ============================================================
// Data Extraction - Dispatcher
// ============================================================

function extractDocumentData(text, docType) {
  switch (docType) {
    case 'fuel': return extractFuelData(text);
    case 'retail': return extractRetailData(text);
    case 'invoice': return extractInvoiceData(text);
    default: return extractGeneralData(text);
  }
}

// ============================================================
// Fuel Receipt Extraction
// ============================================================

const SKIP_WORDS = new Set([
  'WELCOME', 'THANK YOU', 'THANKS', 'HAVE A NICE DAY', 'COME AGAIN',
  'RECEIPT', 'SALE', 'TRANSACTION', 'CUSTOMER COPY', 'MERCHANT COPY',
  'FUEL RECEIPT', 'GAS RECEIPT',
]);

const FUEL_GRADES = {
  'PREMIUM': 'Premium', 'PREM': 'Premium', 'PRM': 'Premium',
  'SUPER': 'Super', 'SUP': 'Super',
  'PLUS': 'Plus', 'MID': 'Mid-Grade', 'MIDGRADE': 'Mid-Grade', 'MID-GRADE': 'Mid-Grade',
  'REGULAR': 'Regular', 'REG': 'Regular',
  'UNLEADED': 'Unleaded', 'UNLD': 'Unleaded', 'UNL': 'Unleaded',
  'DIESEL': 'Diesel', 'DSL': 'Diesel',
  'E85': 'E85', 'E-85': 'E85', 'E15': 'E15', 'E-15': 'E15',
};

function extractFuelData(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toUpperCase();
  const kvPairs = parseKeyValuePairs(text);

  return {
    _type: 'fuel',
    stationName: extractStation(lines, kvPairs),
    address: extractAddress(lines),
    date: extractDate(text),
    time: extractTime(text),
    pumpNumber: extractFromKV(kvPairs, ['PUMP', 'PUMP#', 'PUMP NO', 'PUMP NUMBER']),
    fuelGrade: extractFuelGrade(fullText, kvPairs),
    pricePerGallon: extractPrice(text, kvPairs),
    gallons: extractGallons(text, kvPairs),
    totalAmount: extractTotal(text, kvPairs),
    paymentMethod: extractPayment(fullText),
    transactionId: extractFromKV(kvPairs, ['TRAN', 'TRAN#', 'TRANS', 'TRANS#', 'TRANSACTION', 'INVOICE', 'INVOICE#']),
  };
}

function extractStation(lines, kvPairs) {
  const kvStation = extractFromKV(kvPairs, ['STORE', 'STATION', 'MERCHANT', 'SITE', 'LOCATION']);
  if (kvStation) return kvStation;

  for (const line of lines.slice(0, 8)) {
    const upper = line.toUpperCase().trim();
    if (SKIP_WORDS.has(upper)) continue;
    if (/^\d{1,2}[\/\-\.]\d{1,2}/.test(line)) continue;
    if (/^\d+\s+\w+\s+\w+/.test(line) && /\b(st|ave|rd|blvd|dr|ln|way|hwy|ct|pl|pkwy)\b/i.test(line)) continue;

    const cleaned = line.replace(/[^a-zA-Z\s&'.-]/g, '').trim();
    if (cleaned.length > 2 && cleaned.length < 50) {
      return cleaned;
    }
  }
  return null;
}

function extractAddress(lines) {
  for (const line of lines.slice(0, 10)) {
    if (/^\d+\s+[\w\s]+\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|hwy|highway|ct|court|pl|place|pkwy|parkway|cir|circle)\b/i.test(line)) {
      return line;
    }
  }
  return null;
}

function extractDate(text) {
  const patterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractTime(text) {
  const match = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/);
  return match ? match[1] : null;
}

function extractFuelGrade(upperText, kvPairs) {
  const kvProduct = extractFromKV(kvPairs, ['PRODUCT', 'FUEL', 'FUEL TYPE', 'GRADE', 'FUEL GRADE', 'TYPE']);
  if (kvProduct) {
    const upper = kvProduct.toUpperCase().trim();
    if (FUEL_GRADES[upper]) return FUEL_GRADES[upper];
    return kvProduct;
  }

  for (const [abbr, name] of Object.entries(FUEL_GRADES)) {
    if (upperText.includes(abbr)) return name;
  }
  return null;
}

function extractPrice(text, kvPairs) {
  const kvPrice = extractFromKV(kvPairs, ['PRICE/G', 'PRICE/GAL', 'PPG', 'PRICE PER GALLON', 'UNIT PRICE', 'RATE']);
  if (kvPrice) {
    const num = parseFloat(kvPrice.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) return num;
  }

  const patterns = [
    /(?:price|rate|ppg|per\s*gal|price\/g)[:\s]*\$?\s*([\d]+\.[\d]{1,3})/i,
    /\$?\s*([\d]\.[\d]{1,3})\s*(?:\/\s*gal|per\s*gal)/i,
    /(?:@\s*)\$?\s*([\d]+\.[\d]{1,3})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function extractGallons(text, kvPairs) {
  const kvGal = extractFromKV(kvPairs, ['GALLONS', 'GALLON', 'GAL', 'VOLUME', 'QTY', 'QUANTITY']);
  if (kvGal) {
    const num = parseFloat(kvGal.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0 && num <= 100) return num;
  }

  const patterns = [
    /(?:gallons?|gal|volume)[:\s]*([\d]+(?:\.[\d]{1,3})?)/i,
    /([\d]+\.[\d]{3})\s*(?:gal|gallons?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0 && val <= 100) return val;
    }
  }
  return null;
}

function extractTotal(text, kvPairs) {
  const kvTotal = extractFromKV(kvPairs, ['TOTAL', 'FUEL SALE', 'AMOUNT', 'AMOUNT DUE', 'SALE', 'BALANCE DUE', 'SUBTOTAL']);
  if (kvTotal) {
    const num = parseFloat(kvTotal.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) return num;
  }

  const patterns = [
    /(?:total|amount|due|fuel\s*sale|balance)[:\s]*\$?\s*([\d]+\.[\d]{2})/i,
    /\$\s*([\d]+\.[\d]{2})\s*$/m,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }

  const amounts = [...text.matchAll(/\$\s*([\d]+\.[\d]{2})/g)].map(m => parseFloat(m[1]));
  if (amounts.length > 0) return Math.max(...amounts);
  return null;
}

function extractPayment(upperText) {
  if (upperText.includes('VISA')) return 'Visa';
  if (upperText.includes('MASTERCARD') || upperText.includes('MASTER CARD')) return 'Mastercard';
  if (upperText.includes('AMEX') || upperText.includes('AMERICAN EXPRESS')) return 'Amex';
  if (upperText.includes('DISCOVER')) return 'Discover';
  if (upperText.includes('APPLE PAY')) return 'Apple Pay';
  if (upperText.includes('GOOGLE PAY')) return 'Google Pay';
  if (upperText.includes('DEBIT')) return 'Debit';
  if (upperText.includes('CREDIT')) return 'Credit';
  if (upperText.includes('CASH')) return 'Cash';
  return null;
}

// ============================================================
// Retail Receipt Extraction
// ============================================================

function extractRetailData(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toUpperCase();
  const kvPairs = parseKeyValuePairs(text);

  // Extract line items: lines with a dollar amount at the end
  const lineItems = [];
  for (const line of lines) {
    const m = line.match(/^(.+?)\s+([\d]+\.[\d]{2})\s*$/);
    if (m) {
      const name = m[1].replace(/[\$]/g, '').trim();
      const price = parseFloat(m[2]);
      // Skip totals/subtotals/tax lines
      if (!/\b(subtotal|total|tax|balance|change|cash|visa|mastercard|amex|discover|approved)\b/i.test(name)) {
        lineItems.push({ name, price });
      }
    }
  }

  // Extract subtotal
  let subtotal = null;
  const subMatch = text.match(/subtotal[:\s]*\$?\s*([\d]+\.[\d]{2})/i);
  if (subMatch) subtotal = parseFloat(subMatch[1]);

  // Extract tax
  let tax = null;
  const taxMatch = text.match(/tax[:\s]*(?:[\d.]+%\s*)?\$?\s*([\d]+\.[\d]{2})/i);
  if (taxMatch) tax = parseFloat(taxMatch[1]);

  // Item count
  let itemCount = null;
  const itemsMatch = text.match(/items?\s*(?:sold)?[:\s]*(\d+)/i);
  if (itemsMatch) itemCount = parseInt(itemsMatch[1]);

  return {
    _type: 'retail',
    storeName: extractStation(lines, kvPairs),
    address: extractAddress(lines),
    date: extractDate(text),
    time: extractTime(text),
    lineItems,
    itemCount: itemCount || lineItems.length || null,
    subtotal,
    tax,
    totalAmount: extractTotal(text, kvPairs),
    paymentMethod: extractPayment(fullText),
  };
}

// ============================================================
// Invoice Extraction
// ============================================================

function extractInvoiceData(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toUpperCase();
  const kvPairs = parseKeyValuePairs(text);

  // Invoice number
  let invoiceNum = extractFromKV(kvPairs, ['INVOICE', 'INVOICE #', 'INVOICE#', 'INV', 'INV#']);
  if (!invoiceNum) {
    const invMatch = text.match(/invoice\s*#?\s*:?\s*([A-Z0-9\-]+)/i);
    if (invMatch) invoiceNum = invMatch[1];
  }

  // PO number
  let poNumber = extractFromKV(kvPairs, ['PO', 'PO #', 'PO#', 'PO NUMBER', 'PURCHASE ORDER']);
  if (!poNumber) {
    const poMatch = text.match(/PO\s*#?\s*:?\s*([A-Z0-9\-]+)/i);
    if (poMatch) poNumber = poMatch[1];
  }

  // Due date
  let dueDate = extractFromKV(kvPairs, ['DUE DATE', 'DUE', 'PAYMENT DUE']);
  if (!dueDate) {
    const dueMatch = text.match(/due\s*date[:\s]*([\d\/\-\.]+)/i);
    if (dueMatch) dueDate = dueMatch[1];
  }

  // Bill-to: look for lines after "BILL TO"
  let billTo = null;
  const billToIdx = lines.findIndex(l => /bill\s*to/i.test(l));
  if (billToIdx >= 0 && billToIdx + 1 < lines.length) {
    billTo = lines[billToIdx + 1];
  }

  // Line items (description + amount pattern)
  const lineItems = [];
  for (const line of lines) {
    const m = line.match(/^(.+?)\s+(\d+)\s+\$?([\d,]+\.[\d]{2})\s+\$?([\d,]+\.[\d]{2})\s*$/);
    if (m) {
      lineItems.push({
        description: m[1].trim(),
        qty: parseInt(m[2]),
        rate: parseFloat(m[3].replace(/,/g, '')),
        amount: parseFloat(m[4].replace(/,/g, ''))
      });
    }
  }

  // Payment terms
  let paymentTerms = null;
  const termsMatch = text.match(/(?:payment\s*terms?|terms?)\s*:?\s*(net\s*\d+)/i);
  if (termsMatch) paymentTerms = termsMatch[1];

  return {
    _type: 'invoice',
    vendor: extractStation(lines, kvPairs),
    address: extractAddress(lines),
    invoiceNumber: invoiceNum,
    poNumber,
    date: extractDate(text),
    dueDate,
    billTo,
    lineItems,
    subtotal: extractSubtotal(text),
    totalAmount: extractTotal(text, kvPairs),
    paymentTerms,
  };
}

function extractSubtotal(text) {
  const match = text.match(/subtotal[:\s]*\$?\s*([\d,]+\.[\d]{2})/i);
  return match ? parseFloat(match[1].replace(/,/g, '')) : null;
}

// ============================================================
// General Document Extraction (fallback)
// ============================================================

function extractGeneralData(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toUpperCase();
  const kvPairs = parseKeyValuePairs(text);

  // Extract all dollar amounts
  const amounts = [...text.matchAll(/\$\s*([\d,]+\.[\d]{2})/g)].map(m => parseFloat(m[1].replace(/,/g, '')));

  return {
    _type: 'general',
    heading: lines.length > 0 ? lines[0] : null,
    date: extractDate(text),
    time: extractTime(text),
    totalAmount: amounts.length > 0 ? Math.max(...amounts) : null,
    paymentMethod: extractPayment(fullText),
    amountsFound: amounts,
    keyValuePairs: kvPairs,
    lineCount: lines.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

// ============================================================
// Fraud / Validation Detection
// ============================================================

function runFraudDetection(data, rawText, docType) {
  const alerts = [];

  // Fuel-specific checks
  if (docType === 'fuel') {
    if (data.pricePerGallon !== null) {
      if (data.pricePerGallon < 2.00 || data.pricePerGallon > 7.00) {
        alerts.push({
          level: 'danger',
          message: `Price per gallon ($${data.pricePerGallon.toFixed(2)}) is outside the normal range ($2.00-$7.00). Possible data entry error or fraudulent receipt.`
        });
      } else {
        alerts.push({
          level: 'ok',
          message: `Price per gallon ($${data.pricePerGallon.toFixed(2)}) is within normal market range.`
        });
      }
    }

    if (data.gallons !== null) {
      if (data.gallons > 35) {
        alerts.push({
          level: 'warn',
          message: `Volume (${data.gallons} gal) exceeds most standard vehicle tanks (~35 gal). Could indicate commercial vehicle or potential overcharge.`
        });
      } else if (data.gallons < 0.5) {
        alerts.push({
          level: 'warn',
          message: `Volume (${data.gallons} gal) is unusually low. May indicate a test transaction or OCR misread.`
        });
      } else {
        alerts.push({
          level: 'ok',
          message: `Volume (${data.gallons} gal) is within normal range.`
        });
      }
    }
  }

  // Math cross-reference (fuel and retail)
  if (docType === 'fuel' && data.pricePerGallon && data.gallons && data.totalAmount) {
    const expectedTotal = data.pricePerGallon * data.gallons;
    const diff = Math.abs(expectedTotal - data.totalAmount);
    if (diff > 1.00) {
      alerts.push({
        level: 'danger',
        message: `Total ($${data.totalAmount.toFixed(2)}) doesn't match price x gallons ($${expectedTotal.toFixed(2)}). Discrepancy of $${diff.toFixed(2)} detected.`
      });
    } else {
      alerts.push({
        level: 'ok',
        message: `Total matches price x gallons within tolerance ($${diff.toFixed(2)} variance).`
      });
    }
  }

  if (docType === 'retail' && data.subtotal != null && data.tax != null && data.totalAmount) {
    const expectedTotal = data.subtotal + data.tax;
    const diff = Math.abs(expectedTotal - data.totalAmount);
    if (diff > 0.05) {
      alerts.push({
        level: 'danger',
        message: `Total ($${data.totalAmount.toFixed(2)}) doesn't match subtotal + tax ($${expectedTotal.toFixed(2)}). Discrepancy of $${diff.toFixed(2)}.`
      });
    } else {
      alerts.push({
        level: 'ok',
        message: `Total matches subtotal + tax within tolerance.`
      });
    }
  }

  // Duplicate amount detection (universal)
  const amounts = [...rawText.matchAll(/\$?([\d]+\.[\d]{2})/g)].map(m => m[1]);
  const duplicates = amounts.filter((item, idx) => amounts.indexOf(item) !== idx);
  const uniqueDups = [...new Set(duplicates)];
  if (uniqueDups.length > 0 && data.totalAmount) {
    const suspiciousDups = uniqueDups.filter(d => parseFloat(d) !== data.totalAmount);
    if (suspiciousDups.length > 0) {
      alerts.push({
        level: 'warn',
        message: `Duplicate amounts detected: $${suspiciousDups.join(', $')}. May indicate receipt duplication.`
      });
    }
  }

  // Date check (universal)
  const dateField = data.date || data.dueDate;
  if (dateField) {
    alerts.push({ level: 'ok', message: `Transaction date found: ${dateField}` });
  } else {
    alerts.push({
      level: 'warn',
      message: 'No transaction date detected. Document may be damaged or poorly scanned.'
    });
  }

  // OCR word count (universal)
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  if (wordCount < 10) {
    alerts.push({
      level: 'warn',
      message: `Low text yield (${wordCount} words). Image quality may be too low for reliable extraction.`
    });
  }

  return alerts;
}

// ============================================================
// Utilities
// ============================================================

function escapeHtml(str) {
  if (!str) return str;
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Render Results
// ============================================================

const DOC_TYPE_LABELS = {
  fuel: 'Fuel Receipt',
  retail: 'Retail Receipt',
  invoice: 'Invoice',
  general: 'General Document'
};

const DOC_TYPE_COLORS = {
  fuel: '#c4f54a',
  retail: '#60a5fa',
  invoice: '#5eead4',
  general: '#8888a0'
};

function renderResults(rawText, extracted, alerts, words, docType, avgConfidence) {
  // Document type badge
  if (docTypeBadge) {
    docTypeBadge.textContent = DOC_TYPE_LABELS[docType] || 'Unknown';
    docTypeBadge.style.setProperty('--doc-color', DOC_TYPE_COLORS[docType] || '#888');
    docTypeBadge.style.display = 'inline-flex';
  }

  // OCR confidence bar
  if (ocrConfidenceBar && avgConfidence !== null) {
    ocrConfidenceBar.style.display = 'flex';
    ocrConfidenceVal.textContent = avgConfidence + '%';
    ocrConfidenceFill.style.width = avgConfidence + '%';

    if (avgConfidence >= 80) {
      ocrConfidenceFill.style.background = 'linear-gradient(90deg, #34d399, #a3e635)';
    } else if (avgConfidence >= 50) {
      ocrConfidenceFill.style.background = 'linear-gradient(90deg, #fbbf24, #fb923c)';
    } else {
      ocrConfidenceFill.style.background = 'linear-gradient(90deg, #f87171, #ef4444)';
    }
  }

  // Raw text with word-level confidence coloring
  if (words && words.length > 0) {
    rawTextOutput.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const span = document.createElement('span');
      span.textContent = w.text;

      if (w.confidence >= 80) {
        span.className = 'word-high';
      } else if (w.confidence >= 50) {
        span.className = 'word-mid';
      } else {
        span.className = 'word-low';
      }

      span.title = `Confidence: ${Math.round(w.confidence)}%`;
      frag.appendChild(span);

      // Add space or newline between words
      const next = words[i + 1];
      if (next) {
        // Check if the next word is on a different line
        if (w.line && next.line && w.line.text !== next.line.text) {
          frag.appendChild(document.createTextNode('\n'));
        } else {
          frag.appendChild(document.createTextNode(' '));
        }
      }
    }

    rawTextOutput.appendChild(frag);
  } else {
    rawTextOutput.textContent = rawText || '(No text detected)';
  }

  // Extracted data table (dynamic based on document type)
  const fields = getFieldsForType(extracted);
  extractedTable.innerHTML = fields.map(([name, value]) => `
    <tr>
      <td class="field-name">${escapeHtml(name)}</td>
      <td class="field-value${value ? '' : ' empty'}">${value ? escapeHtml(String(value)) : 'Not detected'}</td>
    </tr>
  `).join('');

  // Fraud alerts
  fraudAlerts.innerHTML = alerts.map(a => `
    <div class="alert-item alert-${a.level}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${a.level === 'ok'
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
          : a.level === 'warn'
            ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
        }
      </svg>
      <span>${escapeHtml(a.message)}</span>
    </div>
  `).join('');

  // Show results
  resultsSection.classList.add('active');
  resultsSection.classList.add('fade-in');
}

function getFieldsForType(extracted) {
  switch (extracted._type) {
    case 'fuel':
      return [
        ['Station', extracted.stationName],
        ['Address', extracted.address],
        ['Date', extracted.date],
        ['Time', extracted.time],
        ['Pump #', extracted.pumpNumber],
        ['Fuel Grade', extracted.fuelGrade],
        ['Price / Gallon', extracted.pricePerGallon ? '$' + extracted.pricePerGallon.toFixed(2) : null],
        ['Gallons', extracted.gallons != null ? String(extracted.gallons) : null],
        ['Total', extracted.totalAmount ? '$' + extracted.totalAmount.toFixed(2) : null],
        ['Payment', extracted.paymentMethod],
        ['Transaction #', extracted.transactionId],
      ];
    case 'retail':
      const itemFields = extracted.lineItems.map((item, i) =>
        [`Item ${i + 1}`, `${item.name} -- $${item.price.toFixed(2)}`]
      );
      return [
        ['Store', extracted.storeName],
        ['Address', extracted.address],
        ['Date', extracted.date],
        ['Time', extracted.time],
        ...itemFields,
        ['Items Sold', extracted.itemCount ? String(extracted.itemCount) : null],
        ['Subtotal', extracted.subtotal ? '$' + extracted.subtotal.toFixed(2) : null],
        ['Tax', extracted.tax ? '$' + extracted.tax.toFixed(2) : null],
        ['Total', extracted.totalAmount ? '$' + extracted.totalAmount.toFixed(2) : null],
        ['Payment', extracted.paymentMethod],
      ];
    case 'invoice':
      const invItemFields = extracted.lineItems.map((item, i) =>
        [`Line ${i + 1}`, `${item.description} (${item.qty} x $${item.rate.toFixed(2)}) = $${item.amount.toFixed(2)}`]
      );
      return [
        ['Vendor', extracted.vendor],
        ['Address', extracted.address],
        ['Invoice #', extracted.invoiceNumber],
        ['PO #', extracted.poNumber],
        ['Date', extracted.date],
        ['Due Date', extracted.dueDate],
        ['Bill To', extracted.billTo],
        ...invItemFields,
        ['Subtotal', extracted.subtotal ? '$' + extracted.subtotal.toFixed(2) : null],
        ['Total', extracted.totalAmount ? '$' + extracted.totalAmount.toFixed(2) : null],
        ['Payment Terms', extracted.paymentTerms],
      ];
    default:
      const kvFields = Object.entries(extracted.keyValuePairs || {}).map(([k, v]) => [k, v]);
      return [
        ['Heading', extracted.heading],
        ['Date', extracted.date],
        ['Time', extracted.time],
        ['Largest Amount', extracted.totalAmount ? '$' + extracted.totalAmount.toFixed(2) : null],
        ['Payment', extracted.paymentMethod],
        ['Words Found', String(extracted.wordCount)],
        ...kvFields,
      ];
  }
}

// ============================================================
// Export JSON
// ============================================================

btnExport.addEventListener('click', () => {
  if (!lastResult) return;

  const exportData = { ...lastResult };
  delete exportData.words; // Don't export raw word data (too large)

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scan-${lastResult.docType}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ============================================================
// Reset
// ============================================================

btnReset.addEventListener('click', () => {
  if (isProcessing) return;
  progressSection.classList.remove('active');
  resultsSection.classList.remove('active');
  resultsSection.classList.remove('fade-in');
  previewImg.style.display = 'none';
  previewImg.src = '';
  if (preprocessedImg) {
    preprocessedImg.style.display = 'none';
    preprocessedImg.src = '';
  }
  if (previewOrigTab) previewOrigTab.classList.add('active');
  if (previewPrepTab) previewPrepTab.classList.remove('active');
  if (docTypeBadge) docTypeBadge.style.display = 'none';
  if (ocrConfidenceBar) ocrConfidenceBar.style.display = 'none';
  fileInput.value = '';
  lastResult = null;
  updateProgress(0, '');
});
