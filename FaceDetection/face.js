/**
 * Face Detection Module
 * Real-time face detection using face-api.js and webcam
 */

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1/model/';

// DOM Elements
const btnStart = document.getElementById('btnStartCamera');
const btnStop = document.getElementById('btnStopCamera');
const cameraStatus = document.getElementById('cameraStatus');
const cameraContainer = document.getElementById('cameraContainer');
const video = document.getElementById('videoFeed');
const canvas = document.getElementById('overlayCanvas');
const ctx = canvas.getContext('2d');
const modelLoading = document.getElementById('modelLoading');
const modelLoadLabel = document.getElementById('modelLoadLabel');
const statFaces = document.getElementById('statFaces');
const statFPS = document.getElementById('statFPS');
const statConf = document.getElementById('statConf');

let stream = null;
let animFrameId = null;
let modelLoaded = false;
let lastFrameTime = 0;
let fpsValues = [];

// Load face detection model
async function loadModel() {
  if (modelLoaded) return;
  modelLoading.style.display = 'block';
  modelLoadLabel.textContent = 'Loading face detection model…';

  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    modelLoaded = true;
    modelLoadLabel.textContent = 'Model loaded.';
  } catch (err) {
    console.error('Failed to load face detection model:', err);
    modelLoadLabel.textContent = 'Failed to load model: ' + err.message;
    throw err;
  } finally {
    setTimeout(() => { modelLoading.style.display = 'none'; }, 800);
  }
}

// Start webcam
async function startCamera() {
  try {
    btnStart.disabled = true;
    btnStart.textContent = 'Starting…';

    await loadModel();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
    });

    video.srcObject = stream;
    await video.play();

    // Size canvas to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Show camera, hide status
    cameraStatus.style.display = 'none';
    cameraContainer.style.display = 'block';
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-flex';

    // Start detection loop
    lastFrameTime = performance.now();
    detectLoop();

  } catch (err) {
    console.error('Camera error:', err);
    btnStart.disabled = false;
    btnStart.textContent = 'Start Camera';

    const statusText = cameraStatus.querySelector('.camera-status-text');
    if (err.name === 'NotAllowedError') {
      statusText.textContent = 'Camera permission denied. Please allow camera access and try again.';
    } else if (err.name === 'NotFoundError') {
      statusText.textContent = 'No camera found. Please connect a webcam and try again.';
    } else {
      statusText.textContent = 'Error: ' + err.message;
    }
  }
}

// Stop webcam
function stopCamera() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  cameraContainer.style.display = 'none';
  cameraStatus.style.display = 'flex';
  btnStop.style.display = 'none';
  btnStart.style.display = 'inline-flex';
  btnStart.disabled = false;
  btnStart.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
    Start Camera
  `;

  statFaces.textContent = 'Faces: 0';
  statFPS.textContent = 'FPS: --';
  statConf.textContent = 'Confidence: --';

  const statusText = cameraStatus.querySelector('.camera-status-text');
  statusText.textContent = 'Camera stopped. Click "Start Camera" to resume.';
}

// Detection loop
async function detectLoop() {
  if (!stream) return;

  const now = performance.now();
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  // FPS calculation (rolling average of last 10 frames)
  fpsValues.push(1000 / dt);
  if (fpsValues.length > 10) fpsValues.shift();
  const avgFps = Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length);

  // Detect faces
  const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5
  }));

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw bounding boxes
  const displaySize = { width: canvas.width, height: canvas.height };
  const resized = faceapi.resizeResults(detections, displaySize);

  for (const det of resized) {
    const box = det.box;
    const score = Math.round(det.score * 100);

    // Box
    ctx.strokeStyle = '#c8ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Corner accents
    const cornerLen = 12;
    ctx.lineWidth = 3;
    // Top-left
    ctx.beginPath(); ctx.moveTo(box.x, box.y + cornerLen); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + cornerLen, box.y); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(box.x + box.width - cornerLen, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + cornerLen); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(box.x, box.y + box.height - cornerLen); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x + cornerLen, box.y + box.height); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(box.x + box.width - cornerLen, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height - cornerLen); ctx.stroke();

    // Label
    const labelText = `${score}%`;
    ctx.font = '600 12px Inter, sans-serif';
    const textWidth = ctx.measureText(labelText).width;
    ctx.fillStyle = '#c8ff00';
    ctx.fillRect(box.x, box.y - 20, textWidth + 10, 20);
    ctx.fillStyle = '#000';
    ctx.fillText(labelText, box.x + 5, box.y - 6);
  }

  // Update stats
  statFaces.textContent = `Faces: ${resized.length}`;
  statFPS.textContent = `FPS: ${avgFps}`;
  if (resized.length > 0) {
    const avgConf = Math.round(resized.reduce((s, d) => s + d.score, 0) / resized.length * 100);
    statConf.textContent = `Confidence: ${avgConf}%`;
  } else {
    statConf.textContent = 'Confidence: --';
  }

  animFrameId = requestAnimationFrame(detectLoop);
}

// Event listeners
btnStart.addEventListener('click', startCamera);
btnStop.addEventListener('click', stopCamera);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }
});
