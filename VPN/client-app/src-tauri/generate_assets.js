const fs = require('fs');
const path = require('path');

function createBmp(width, height, getPixelRGB, filePath) {
    const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;

    const buffer = Buffer.alloc(fileSize);

    // BITMAPFILEHEADER
    buffer.write('BM', 0);
    buffer.writeUInt32LE(fileSize, 2); // File size
    buffer.writeUInt16LE(0, 6); // Reserved 1
    buffer.writeUInt16LE(0, 8); // Reserved 2
    buffer.writeUInt32LE(54, 10); // Offset to pixel data

    // BITMAPINFOHEADER
    buffer.writeUInt32LE(40, 14); // Header size
    buffer.writeInt32LE(width, 18); // Width
    buffer.writeInt32LE(height, 22); // Height (positive means bottom-up)
    buffer.writeUInt16LE(1, 26); // Color planes
    buffer.writeUInt16LE(24, 28); // Bits per pixel
    buffer.writeUInt32LE(0, 30); // Compression method (none)
    buffer.writeUInt32LE(pixelArraySize, 34); // Image size
    buffer.writeInt32LE(2835, 38); // Horizontal resolution (72dpi)
    buffer.writeInt32LE(2835, 42); // Vertical resolution (72dpi)
    buffer.writeUInt32LE(0, 46); // Colors in color palette
    buffer.writeUInt32LE(0, 50); // Important colors

    // Pixel data (bottom-up left-to-right)
    let offset = 54;
    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            const [r, g, b] = getPixelRGB(x, height - 1 - y); // We flip y so 0,0 is top-left in our logic
            buffer.writeUInt8(b, offset);     // B
            buffer.writeUInt8(g, offset + 1); // G
            buffer.writeUInt8(r, offset + 2); // R
            offset += 3;
        }
        // Pad to 4 bytes multiple
        const padding = rowSize - (width * 3);
        if (padding > 0) {
            buffer.fill(0, offset, offset + padding);
            offset += padding;
        }
    }

    fs.writeFileSync(filePath, buffer);
    console.log(`Saved ${filePath}`);
}

const outDir = path.join(__dirname, 'assets');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Dialog: 493x312
// Banner: 493x58

const bgColor = [25, 27, 40];
const accentColor = [55, 75, 200];
const white = [255, 255, 255];

createBmp(493, 312, (x, y) => {
    if (x < 164) {
        const r = Math.floor(bgColor[0] + (accentColor[0] - bgColor[0]) * y / 600);
        const g = Math.floor(bgColor[1] + (accentColor[1] - bgColor[1]) * y / 600);
        const b = Math.floor(bgColor[2] + (accentColor[2] - bgColor[2]) * y / 600);
        return [r, g, b];
    }
    return white;
}, path.join(outDir, 'dialog.bmp'));

createBmp(493, 58, (x, y) => {
    if (y === 57) return [220, 220, 220]; // Subtle border at the bottom
    return white;
}, path.join(outDir, 'banner.bmp'));

console.log('Generating WiX assets via Node.js complete!');
