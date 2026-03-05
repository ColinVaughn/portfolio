const SampleReceipts = {

  _createCanvas(width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  },

  _drawReceiptBackground(ctx, w, h) {
    ctx.fillStyle = '#f5f2ea';
    ctx.fillRect(0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      d[i] += noise;
      d[i + 1] += noise;
      d[i + 2] += noise;
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.45);
    ctx.lineTo(w, h * 0.45);
    ctx.stroke();
  },

  _text(ctx, str, x, y, opts = {}) {
    const size = opts.size || 26;
    const weight = opts.bold ? 'bold' : 'normal';
    const align = opts.align || 'left';
    const color = opts.color || '#1a1a1a';
    ctx.font = `${weight} ${size}px "Courier New", monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    const jx = (Math.random() - 0.5) * 0.5;
    const jy = (Math.random() - 0.5) * 0.3;
    ctx.fillText(str, x + jx, y + jy);
    ctx.textAlign = 'left';
  },

  _dashedLine(ctx, x, y, w) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  generateFuelReceipt() {
    const w = 640, h = 1040;
    const c = this._createCanvas(w, h);
    const ctx = c.getContext('2d');
    this._drawReceiptBackground(ctx, w, h);

    const mx = 48;
    const rw = w - mx * 2;
    let y = 72;
    const ln = 36;

    this._text(ctx, 'SHELL', w / 2, y, { size: 44, bold: true, align: 'center' });
    y += ln + 8;
    this._text(ctx, '1425 Main Street', w / 2, y, { size: 22, align: 'center', color: '#333' });
    y += ln - 4;
    this._text(ctx, 'Clemson, SC 29631', w / 2, y, { size: 22, align: 'center', color: '#333' });
    y += ln - 4;
    this._text(ctx, '(864) 555-0142', w / 2, y, { size: 22, align: 'center', color: '#333' });
    y += ln + 12;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    this._text(ctx, 'TRAN# : 004829', mx, y); y += ln;
    this._text(ctx, 'PUMP  : 7', mx, y); y += ln;
    this._text(ctx, 'DATE  : 02/28/2026', mx, y); y += ln;
    this._text(ctx, 'TIME  : 02:34 PM', mx, y); y += ln + 8;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    this._text(ctx, 'PRODUCT : REGULAR UNLEADED', mx, y); y += ln;
    this._text(ctx, 'PRICE/G : $ 3.459', mx, y); y += ln;
    this._text(ctx, 'GALLONS : 12.500', mx, y); y += ln + 8;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    this._text(ctx, 'FUEL SALE', mx, y);
    this._text(ctx, '$ 43.24', w - mx, y, { align: 'right', bold: true }); y += ln + 8;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    this._text(ctx, 'VISA', mx, y);
    this._text(ctx, '****4821', w - mx, y, { align: 'right' }); y += ln;
    this._text(ctx, 'AUTH# : 089234', mx, y); y += ln + 20;

    this._text(ctx, 'THANK YOU', w / 2, y, { size: 28, bold: true, align: 'center' });
    y += ln;
    this._text(ctx, 'DRIVE SAFELY', w / 2, y, { size: 20, align: 'center', color: '#555' });

    return new Promise(resolve => c.toBlob(resolve, 'image/png'));
  },

  generateRetailReceipt() {
    const w = 680, h = 1160;
    const c = this._createCanvas(w, h);
    const ctx = c.getContext('2d');
    this._drawReceiptBackground(ctx, w, h);

    const mx = 48;
    const rw = w - mx * 2;
    let y = 72;
    const ln = 36;

    this._text(ctx, 'RIVERSIDE GROCERY', w / 2, y, { size: 36, bold: true, align: 'center' });
    y += ln + 4;
    this._text(ctx, '892 Oak Avenue', w / 2, y, { size: 22, align: 'center', color: '#333' });
    y += ln - 4;
    this._text(ctx, 'Anderson, SC 29621', w / 2, y, { size: 22, align: 'center', color: '#333' });
    y += ln + 12;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    this._text(ctx, '03/01/2026  10:22 AM', mx, y, { size: 22, color: '#444' });
    this._text(ctx, 'REG #3', w - mx, y, { size: 22, align: 'right', color: '#444' });
    y += ln + 8;

    const items = [
      ['BANANAS  1.2 LB', '0.79'],
      ['WHOLE MILK 1 GAL', '4.29'],
      ['WHEAT BREAD', '3.49'],
      ['CHICKEN BREAST 2LB', '8.98'],
      ['CHEDDAR CHEESE 8OZ', '4.59'],
      ['DOZEN EGGS LARGE', '3.85'],
    ];

    for (const [name, price] of items) {
      this._text(ctx, name, mx, y, { size: 24 });
      this._text(ctx, price, w - mx, y, { size: 24, align: 'right' });
      y += ln;
    }
    y += 8;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    this._text(ctx, 'SUBTOTAL', mx, y);
    this._text(ctx, '$ 25.99', w - mx, y, { align: 'right' }); y += ln;
    this._text(ctx, 'TAX  6.0%', mx, y);
    this._text(ctx, '$ 1.56', w - mx, y, { align: 'right' }); y += ln;
    y += 8;

    this._text(ctx, 'TOTAL', mx, y, { bold: true, size: 30 });
    this._text(ctx, '$ 27.55', w - mx, y, { bold: true, size: 30, align: 'right' }); y += ln + 8;

    this._dashedLine(ctx, mx, y, rw);
    y += ln;

    this._text(ctx, 'MASTERCARD', mx, y);
    this._text(ctx, '****7293', w - mx, y, { align: 'right' }); y += ln;
    this._text(ctx, 'APPROVED', mx, y, { color: '#333' }); y += ln + 20;

    this._text(ctx, 'ITEMS SOLD: 6', w / 2, y, { size: 22, align: 'center', color: '#555' });
    y += ln;
    this._text(ctx, 'THANK YOU FOR SHOPPING', w / 2, y, { size: 24, bold: true, align: 'center' });
    y += ln;
    this._text(ctx, 'SAVE THIS RECEIPT', w / 2, y, { size: 20, align: 'center', color: '#555' });

    return new Promise(resolve => c.toBlob(resolve, 'image/png'));
  },

  generateInvoice() {
    const w = 960, h = 1160;
    const c = this._createCanvas(w, h);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const mx = 64;
    const rw = w - mx * 2;
    let y = 88;
    const ln = 40;

    this._text(ctx, 'INVOICE', w - mx, y, { size: 56, bold: true, align: 'right', color: '#222' });
    y += 20;
    this._text(ctx, 'Vaughn Digital LLC', mx, y, { size: 32, bold: true });
    y += ln;
    this._text(ctx, '310 College Ave, Suite 200', mx, y, { size: 22, color: '#555' });
    y += ln - 8;
    this._text(ctx, 'Clemson, SC 29631', mx, y, { size: 22, color: '#555' });
    y += ln + 16;

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(mx, y - 8, rw, ln * 2 + 16);
    y += ln - 8;
    this._text(ctx, 'INVOICE # : INV-2026-0041', mx + 24, y, { size: 24 });
    this._text(ctx, 'DATE : 02/15/2026', w - mx - 24, y, { size: 24, align: 'right' });
    y += ln;
    this._text(ctx, 'DUE DATE  : 03/15/2026', mx + 24, y, { size: 24 });
    this._text(ctx, 'PO # : PO-8830', w - mx - 24, y, { size: 24, align: 'right' });
    y += ln + 24;

    this._text(ctx, 'BILL TO:', mx, y, { size: 22, bold: true, color: '#666' });
    y += ln - 4;
    this._text(ctx, 'Acme Solutions Inc.', mx, y, { size: 26 });
    y += ln - 4;
    this._text(ctx, '500 Industry Parkway, Atlanta, GA 30301', mx, y, { size: 22, color: '#555' });
    y += ln + 20;

    ctx.fillStyle = '#222';
    ctx.fillRect(mx, y - 8, rw, ln + 8);
    y += ln - 12;
    this._text(ctx, 'DESCRIPTION', mx + 16, y, { size: 22, bold: true, color: '#fff' });
    this._text(ctx, 'QTY', w - mx - 300, y, { size: 22, bold: true, color: '#fff', align: 'center' });
    this._text(ctx, 'RATE', w - mx - 160, y, { size: 22, bold: true, color: '#fff', align: 'center' });
    this._text(ctx, 'AMOUNT', w - mx - 16, y, { size: 22, bold: true, color: '#fff', align: 'right' });
    y += ln + 8;

    const lineItems = [
      ['Web Application Dev', '40', '$85.00', '$3,400.00'],
      ['API Integration', '12', '$95.00', '$1,140.00'],
      ['QA Testing', '8', '$65.00', '$520.00'],
    ];

    for (const [desc, qty, rate, amount] of lineItems) {
      if (lineItems.indexOf(lineItems.find(l => l[0] === desc)) % 2 === 1) {
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(mx, y - 28, rw, ln + 4);
      }
      this._text(ctx, desc, mx + 16, y, { size: 24 });
      this._text(ctx, qty, w - mx - 300, y, { size: 24, align: 'center' });
      this._text(ctx, rate, w - mx - 160, y, { size: 24, align: 'center' });
      this._text(ctx, amount, w - mx - 16, y, { size: 24, align: 'right' });
      y += ln + 4;
    }

    y += 16;

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w - mx - 360, y); ctx.lineTo(w - mx, y); ctx.stroke();
    y += ln;

    this._text(ctx, 'SUBTOTAL', w - mx - 360, y, { size: 24, color: '#555' });
    this._text(ctx, '$5,060.00', w - mx - 16, y, { size: 24, align: 'right' }); y += ln;
    this._text(ctx, 'TAX (0%)', w - mx - 360, y, { size: 24, color: '#555' });
    this._text(ctx, '$0.00', w - mx - 16, y, { size: 24, align: 'right' }); y += ln + 8;

    ctx.fillStyle = '#222';
    ctx.fillRect(w - mx - 360, y - 8, 360, ln + 16);
    y += ln - 4;
    this._text(ctx, 'TOTAL', w - mx - 344, y, { size: 28, bold: true, color: '#fff' });
    this._text(ctx, '$5,060.00', w - mx - 16, y, { size: 28, bold: true, color: '#fff', align: 'right' });
    y += ln + 32;

    this._text(ctx, 'Payment Terms: Net 30', mx, y, { size: 20, color: '#888' });
    y += ln - 8;
    this._text(ctx, 'Please make checks payable to Vaughn Digital LLC', mx, y, { size: 20, color: '#888' });

    return new Promise(resolve => c.toBlob(resolve, 'image/png'));
  }
};
