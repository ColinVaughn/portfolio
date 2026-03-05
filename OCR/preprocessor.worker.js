self.onmessage = function(e) {
  const { imageData, width, height } = e.data;
  const data = imageData.data;
  const w = width;
  const h = height;
  const len = w * h;

  // 1. Grayscale
  const gray = new Float32Array(len);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 2. Fast Median Filter (3x3)
  // Pre-allocate array to avoid GC overhead
  const window = new Float32Array(9);
  const denoised = new Float32Array(len);
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
        denoised[idx] = gray[idx];
        continue;
      }
      
      // Collect neighborhood
      window[0] = gray[(y - 1) * w + (x - 1)];
      window[1] = gray[(y - 1) * w + x];
      window[2] = gray[(y - 1) * w + (x + 1)];
      window[3] = gray[y * w + (x - 1)];
      window[4] = gray[y * w + x];
      window[5] = gray[y * w + (x + 1)];
      window[6] = gray[(y + 1) * w + (x - 1)];
      window[7] = gray[(y + 1) * w + x];
      window[8] = gray[(y + 1) * w + (x + 1)];

      // Inline insertion sort for 9 elements (extremely fast compared to Array.sort)
      for (let i = 1; i < 9; i++) {
        let key = window[i];
        let j = i - 1;
        while (j >= 0 && window[j] > key) {
          window[j + 1] = window[j];
          j--;
        }
        window[j + 1] = key;
      }
      denoised[idx] = window[4]; // Median
    }
  }

  // 3. Unsharp Mask (Sharpening)
  // Kernel: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]
  const sharpened = new Float32Array(len);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
        sharpened[idx] = denoised[idx];
        continue;
      }
      
      const val = 5 * denoised[idx] 
                - denoised[(y - 1) * w + x] 
                - denoised[y * w + (x - 1)] 
                - denoised[y * w + (x + 1)] 
                - denoised[(y + 1) * w + x];
                
      sharpened[idx] = Math.max(0, Math.min(255, val));
    }
  }

  // 4. Contrast normalization (histogram stretch)
  // To find percentiles fast without sorting the entire array, we use an approximation or partial sort.
  // For production, sorting a full Float32Array of 1M elements still takes 50-100ms in a worker.
  // A histogram approach is faster for 8-bit equivalent values.
  const histogram = new Int32Array(256);
  for (let i = 0; i < len; i++) {
    histogram[Math.floor(sharpened[i])] += 1;
  }
  
  let clipLow = 0, clipHigh = 255;
  const clipCount = Math.floor(len * 0.02);
  let count = 0;
  for (let i = 0; i < 256; i++) {
    count += histogram[i];
    if (count > clipCount) { clipLow = i; break; }
  }
  count = 0;
  for (let i = 255; i >= 0; i--) {
    count += histogram[i];
    if (count > clipCount) { clipHigh = i; break; }
  }
  const clipRange = clipHigh - clipLow || 1;

  const contrast = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    contrast[i] = Math.max(0, Math.min(255, ((sharpened[i] - clipLow) / clipRange) * 255));
  }

  // 5. Adaptive thresholding (local mean using integral image)
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += contrast[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
    }
  }

  const blockSize = Math.max(15, Math.round(Math.min(w, h) / 20) | 1);
  const C = 8; 
  const halfBlock = Math.floor(blockSize / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - halfBlock);
      const y1 = Math.max(0, y - halfBlock);
      const x2 = Math.min(w - 1, x + halfBlock);
      const y2 = Math.min(h - 1, y + halfBlock);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);

      const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)]
                - integral[y1 * (w + 1) + (x2 + 1)]
                - integral[(y2 + 1) * (w + 1) + x1]
                + integral[y1 * (w + 1) + x1];
      const localMean = sum / area;

      const idx = (y * w + x) * 4;
      const v = contrast[y * w + x] < (localMean - C) ? 0 : 255;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  // Send back
  self.postMessage({ processedData: imageData });
};
