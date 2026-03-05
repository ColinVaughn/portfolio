/**
 * Sample Image Generator
 * Programmatically generates receipt/invoice images on canvas for demo purposes.
 * No external image files needed - everything is drawn via Canvas API.
 */

const SampleReceipts = {

  // Shared drawing helpers
  _createCanvas(width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  },

  _drawReceiptBackground(ctx, w, h) {
    // Off-white paper
    ctx.fillStyle = '#f5f2ea';
    ctx.fillRect(0, 0, w, h);

    // Subtle paper texture (noise grain)
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      d[i] += noise;
      d[i + 1] += noise;
      d[i + 2] += noise;
    }
    ctx.putImageData(imgData, 0, 0);

    // Subtle fold line
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.45);
    ctx.lineTo(w, h * 0.45);
    ctx.stroke();
  },

  _text(ctx, str, x, y, opts = {}) {
    const size = opts.size || 13;
    const weight = opts.bold ? 'bold' : 'normal';
    const align = opts.align || 'left';
    const color = opts.color || '#1a1a1a';
    ctx.font = `${weight} ${size}px "Courier New", monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    // Slight imperfection: tiny random offset to mimic thermal print
    const jx = (Math.random() - 0.5) * 0.5;
    const jy = (Math.random() - 0.5) * 0.3;
    ctx.fillText(str, x + jx, y + jy);
    ctx.textAlign = 'left';
  },

  _dashedLine(ctx, x, y, w) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  // 1. Gas station receipt
  generateFuelReceipt() {
    const w = 320, h = 520;
    const c = this._createCanvas(w, h);
    const ctx = c.getContext('2d');
    this._drawReceiptBackground(ctx, w, h);

    const mx = 24; // margin
    const rw = w - mx * 2; // content width
    let y = 36;
    const ln = 18; // line height

    // Header
    this._text(ctx, 'SHELL', w / 2, y, { size: 22, bold: true, align: 'center' });
    y += ln + 4;
    this._text(ctx, '1425 Main Street', w / 2, y, { size: 11, align: 'center', color: '#333' });
    y += ln - 2;
    this._text(ctx, 'Clemson, SC 29631', w / 2, y, { size: 11, align: 'center', color: '#333' });
    y += ln - 2;
    this._text(ctx, '(864) 555-0142', w / 2, y, { size: 11, align: 'center', color: '#333' });
    y += ln + 6;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    // Transaction info
    this._text(ctx, 'TRAN# : 004829', mx, y); y += ln;
    this._text(ctx, 'PUMP  : 7', mx, y); y += ln;
    this._text(ctx, 'DATE  : 02/28/2026', mx, y); y += ln;
    this._text(ctx, 'TIME  : 02:34 PM', mx, y); y += ln + 4;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    // Fuel info
    this._text(ctx, 'PRODUCT : REGULAR UNLEADED', mx, y); y += ln;
    this._text(ctx, 'PRICE/G : $ 3.459', mx, y); y += ln;
    this._text(ctx, 'GALLONS : 12.500', mx, y); y += ln + 4;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    // Total
    this._text(ctx, 'FUEL SALE', mx, y);
    this._text(ctx, '$ 43.24', w - mx, y, { align: 'right', bold: true }); y += ln + 4;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    // Payment
    this._text(ctx, 'VISA', mx, y);
    this._text(ctx, '****4821', w - mx, y, { align: 'right' }); y += ln;
    this._text(ctx, 'AUTH# : 089234', mx, y); y += ln + 10;

    // Footer
    this._text(ctx, 'THANK YOU', w / 2, y, { size: 14, bold: true, align: 'center' });
    y += ln;
    this._text(ctx, 'DRIVE SAFELY', w / 2, y, { size: 10, align: 'center', color: '#555' });

    return new Promise(resolve => c.toBlob(resolve, 'image/png'));
  },

  // 2. Retail / grocery receipt
  generateRetailReceipt() {
    const w = 340, h = 580;
    const c = this._createCanvas(w, h);
    const ctx = c.getContext('2d');
    this._drawReceiptBackground(ctx, w, h);

    const mx = 24;
    const rw = w - mx * 2;
    let y = 36;
    const ln = 18;

    // Header
    this._text(ctx, 'RIVERSIDE GROCERY', w / 2, y, { size: 18, bold: true, align: 'center' });
    y += ln + 2;
    this._text(ctx, '892 Oak Avenue', w / 2, y, { size: 11, align: 'center', color: '#333' });
    y += ln - 2;
    this._text(ctx, 'Anderson, SC 29621', w / 2, y, { size: 11, align: 'center', color: '#333' });
    y += ln + 6;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    // Date/time
    this._text(ctx, '03/01/2026  10:22 AM', mx, y, { size: 11, color: '#444' });
    this._text(ctx, 'REG #3', w - mx, y, { size: 11, align: 'right', color: '#444' });
    y += ln + 4;

    // Items
    const items = [
      ['BANANAS  1.2 LB', '0.79'],
      ['WHOLE MILK 1 GAL', '4.29'],
      ['WHEAT BREAD', '3.49'],
      ['CHICKEN BREAST 2LB', '8.98'],
      ['CHEDDAR CHEESE 8OZ', '4.59'],
      ['DOZEN EGGS LARGE', '3.85'],
    ];

    for (const [name, price] of items) {
      this._text(ctx, name, mx, y, { size: 12 });
      this._text(ctx, price, w - mx, y, { size: 12, align: 'right' });
      y += ln;
    }
    y += 4;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    // Totals
    this._text(ctx, 'SUBTOTAL', mx, y);
    this._text(ctx, '$ 25.99', w - mx, y, { align: 'right' }); y += ln;
    this._text(ctx, 'TAX  6.0%', mx, y);
    this._text(ctx, '$ 1.56', w - mx, y, { align: 'right' }); y += ln;
    y += 4;

    this._text(ctx, 'TOTAL', mx, y, { bold: true, size: 15 });
    this._text(ctx, '$ 27.55', w - mx, y, { bold: true, size: 15, align: 'right' }); y += ln + 4;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    // Payment
    this._text(ctx, 'MASTERCARD', mx, y);
    this._text(ctx, '****7293', w - mx, y, { align: 'right' }); y += ln;
    this._text(ctx, 'APPROVED', mx, y, { color: '#333' }); y += ln + 10;

    // Footer
    this._text(ctx, 'ITEMS SOLD: 6', w / 2, y, { size: 11, align: 'center', color: '#555' });
    y += ln;
    this._text(ctx, 'THANK YOU FOR SHOPPING', w / 2, y, { size: 12, bold: true, align: 'center' });
    y += ln;
    this._text(ctx, 'SAVE THIS RECEIPT', w / 2, y, { size: 10, align: 'center', color: '#555' });

    return new Promise(resolve => c.toBlob(resolve, 'image/png'));
  },

  // 3. Invoice
  generateInvoice() {
    const w = 480, h = 580;
    const c = this._createCanvas(w, h);
    const ctx = c.getContext('2d');

    // White background (invoices are typically clean)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const mx = 32;
    const rw = w - mx * 2;
    let y = 44;
    const ln = 20;

    // Header
    this._text(ctx, 'INVOICE', w - mx, y, { size: 28, bold: true, align: 'right', color: '#222' });
    y += 10;
    this._text(ctx, 'Vaughn Digital LLC', mx, y, { size: 16, bold: true });
    y += ln;
    this._text(ctx, '310 College Ave, Suite 200', mx, y, { size: 11, color: '#555' });
    y += ln - 4;
    this._text(ctx, 'Clemson, SC 29631', mx, y, { size: 11, color: '#555' });
    y += ln + 8;

    // Invoice meta
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(mx, y - 4, rw, ln * 2 + 8);
    y += ln - 4;
    this._text(ctx, 'INVOICE # : INV-2026-0041', mx + 12, y, { size: 12 });
    this._text(ctx, 'DATE : 02/15/2026', w - mx - 12, y, { size: 12, align: 'right' });
    y += ln;
    this._text(ctx, 'DUE DATE  : 03/15/2026', mx + 12, y, { size: 12 });
    this._text(ctx, 'PO # : PO-8830', w - mx - 12, y, { size: 12, align: 'right' });
    y += ln + 12;

    // Bill to
    this._text(ctx, 'BILL TO:', mx, y, { size: 11, bold: true, color: '#666' });
    y += ln - 2;
    this._text(ctx, 'Acme Solutions Inc.', mx, y, { size: 13 });
    y += ln - 2;
    this._text(ctx, '500 Industry Parkway, Atlanta, GA 30301', mx, y, { size: 11, color: '#555' });
    y += ln + 10;

    // Table header
    ctx.fillStyle = '#222';
    ctx.fillRect(mx, y - 4, rw, ln + 4);
    y += ln - 6;
    this._text(ctx, 'DESCRIPTION', mx + 8, y, { size: 11, bold: true, color: '#fff' });
    this._text(ctx, 'QTY', w - mx - 150, y, { size: 11, bold: true, color: '#fff', align: 'center' });
    this._text(ctx, 'RATE', w - mx - 80, y, { size: 11, bold: true, color: '#fff', align: 'center' });
    this._text(ctx, 'AMOUNT', w - mx - 8, y, { size: 11, bold: true, color: '#fff', align: 'right' });
    y += ln + 4;

    // Line items
    const lineItems = [
      ['Web Application Dev', '40', '$85.00', '$3,400.00'],
      ['API Integration', '12', '$95.00', '$1,140.00'],
      ['QA Testing', '8', '$65.00', '$520.00'],
    ];

    for (const [desc, qty, rate, amount] of lineItems) {
      // Alternating row bg
      if (lineItems.indexOf(lineItems.find(l => l[0] === desc)) % 2 === 1) {
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(mx, y - 14, rw, ln + 2);
      }
      this._text(ctx, desc, mx + 8, y, { size: 12 });
      this._text(ctx, qty, w - mx - 150, y, { size: 12, align: 'center' });
      this._text(ctx, rate, w - mx - 80, y, { size: 12, align: 'center' });
      this._text(ctx, amount, w - mx - 8, y, { size: 12, align: 'right' });
      y += ln + 2;
    }

    y += 8;

    // Divider
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w - mx - 180, y); ctx.lineTo(w - mx, y); ctx.stroke();
    y += ln;

    // Totals
    this._text(ctx, 'SUBTOTAL', w - mx - 180, y, { size: 12, color: '#555' });
    this._text(ctx, '$5,060.00', w - mx - 8, y, { size: 12, align: 'right' }); y += ln;
    this._text(ctx, 'TAX (0%)', w - mx - 180, y, { size: 12, color: '#555' });
    this._text(ctx, '$0.00', w - mx - 8, y, { size: 12, align: 'right' }); y += ln + 4;

    ctx.fillStyle = '#222';
    ctx.fillRect(w - mx - 180, y - 4, 180, ln + 8);
    y += ln - 2;
    this._text(ctx, 'TOTAL', w - mx - 172, y, { size: 14, bold: true, color: '#fff' });
    this._text(ctx, '$5,060.00', w - mx - 8, y, { size: 14, bold: true, color: '#fff', align: 'right' });
    y += ln + 16;

    // Payment terms
    this._text(ctx, 'Payment Terms: Net 30', mx, y, { size: 10, color: '#888' });
    y += ln - 4;
    this._text(ctx, 'Please make checks payable to Vaughn Digital LLC', mx, y, { size: 10, color: '#888' });

    return new Promise(resolve => c.toBlob(resolve, 'image/png'));
  }
};
