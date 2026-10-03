/**
 * OLED Video & Bitmap Studio
 * Engine for ESP32-S3 + SH1106 128x64 OLED (U8g2 Library)
 */

// DOM Elements
const fileInput = document.getElementById('file-input');
const dropzone = document.getElementById('dropzone');
const mediaMeta = document.getElementById('media-meta');
const metaName = document.getElementById('meta-name');
const metaRes = document.getElementById('meta-res');
const metaDuration = document.getElementById('meta-duration');

const displayResSelect = document.getElementById('display-res');
const fitModeSelect = document.getElementById('fit-mode');
const ditherModeSelect = document.getElementById('dither-mode');
const thresholdSlider = document.getElementById('threshold-slider');
const thresholdVal = document.getElementById('threshold-val');
const invertCheck = document.getElementById('invert-check');

// Rotation Controls
const rotationSelect = document.getElementById('rotation-select');
const btnRotateCcw = document.getElementById('btn-rotate-ccw');
const btnRotateCw = document.getElementById('btn-rotate-cw');
let currentRotation = 0; // 0, 90, 180, 270

// Crop Position Controls
const cropPositionSection = document.getElementById('crop-position-section');
const cropSliderLabel = document.getElementById('crop-slider-label');
const cropYSlider = document.getElementById('crop-y-slider');
const cropYVal = document.getElementById('crop-y-val');
const btnCropPresets = document.querySelectorAll('.btn-crop-preset');
const presetPosStart = document.getElementById('preset-pos-start');
const presetPosCenter = document.getElementById('preset-pos-center');
const presetPosEnd = document.getElementById('preset-pos-end');
const cropSliderHint = document.getElementById('crop-slider-hint');

const videoControlsSection = document.getElementById('video-controls-section');
const fpsSelector = document.getElementById('fps-selector');
const fpsVal = document.getElementById('fps-val');
const trimStart = document.getElementById('trim-start');
const trimEnd = document.getElementById('trim-end');
const maxFramesInput = document.getElementById('max-frames');
const processBtn = document.getElementById('process-btn');

// Image Luz y Sombras Controls
const imageControlsSection = document.getElementById('image-controls-section');
const modeOptStatic = document.getElementById('mode-opt-static');
const modeOptAnim = document.getElementById('mode-opt-anim');
const animImageOptions = document.getElementById('anim-image-options');
const imgAnimDuration = document.getElementById('img-anim-duration');
const imgAnimFps = document.getElementById('img-anim-fps');
const imgAnimIntensity = document.getElementById('img-anim-intensity');
const btnGenerateAnim = document.getElementById('btn-generate-anim');

// Video MAX Duration Controls
const btnTrimMax = document.getElementById('btn-trim-max');
const checkTrimMax = document.getElementById('check-trim-max');

const oledCanvas = document.getElementById('oled-canvas');
const oledCtx = oledCanvas.getContext('2d');
const scratchCanvas = document.getElementById('scratch-canvas');
const scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true });
const processVideo = document.getElementById('process-video');

const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const scrubber = document.getElementById('scrubber');
const frameCounter = document.getElementById('frame-counter');
const colorDots = document.querySelectorAll('.color-dot');

const statFrames = document.getElementById('stat-frames');
const statSize = document.getElementById('stat-size');
const statFlashPct = document.getElementById('stat-flash-pct');
const statAnimTime = document.getElementById('stat-anim-time');

const codeInoOutput = document.getElementById('code-ino-output');
const codeHOutput = document.getElementById('code-h-output');
const copyInoBtn = document.getElementById('copy-ino-btn');
const copyHBtn = document.getElementById('copy-h-btn');
const downloadInoBtn = document.getElementById('download-ino-btn');
const downloadHBtn = document.getElementById('download-h-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const toast = document.getElementById('toast');

// State
let loadedFile = null;
let isVideo = false;
let loadedImage = null;
let imageMode = 'static'; // 'static' | 'anim'
let currentWidth = 128;
let currentHeight = 64;
let extractedFrames = []; // Array of Uint8Array (XBM byte arrays)
let isPlaying = false;
let playInterval = null;
let currentFrameIndex = 0;
let oledColor = '#00e5ff'; // default Cyan

// Initialize canvas
function initCanvas(w = 128, h = 64) {
  currentWidth = w;
  currentHeight = h;
  oledCanvas.width = w;
  oledCanvas.height = h;
  scratchCanvas.width = w;
  scratchCanvas.height = h;
  clearOled();
}
initCanvas(128, 64);

function clearOled() {
  oledCtx.fillStyle = '#000000';
  oledCtx.fillRect(0, 0, currentWidth, currentHeight);
}

// Draw initial demo test pattern
function drawWelcomeScreen() {
  oledCtx.fillStyle = '#000';
  oledCtx.fillRect(0, 0, 128, 64);
  oledCtx.fillStyle = oledColor;
  oledCtx.font = '10px monospace';
  oledCtx.fillText('ESP32-S3 OLED 1.3"', 8, 20);
  oledCtx.fillText('SDA: 8 | SCL: 13', 14, 35);
  oledCtx.font = '8px monospace';
  oledCtx.fillText('Arrastra un video aqui', 6, 52);
  oledCtx.strokeStyle = oledColor;
  oledCtx.strokeRect(2, 2, 124, 60);
}
drawWelcomeScreen();

// UI Event Handlers
function refreshImageDisplay() {
  if (!isVideo && loadedImage) {
    if (imageMode === 'anim') {
      generateLightShadowAnimation();
    } else {
      processSingleImage();
    }
  }
}

thresholdSlider.addEventListener('input', () => {
  thresholdVal.textContent = thresholdSlider.value;
  refreshImageDisplay();
});

fpsSelector.addEventListener('input', () => {
  fpsVal.textContent = `${fpsSelector.value} FPS`;
  updateStats();
});

invertCheck.addEventListener('change', () => {
  refreshImageDisplay();
});

ditherModeSelect.addEventListener('change', () => {
  refreshImageDisplay();
});

fitModeSelect.addEventListener('change', () => {
  const isCover = fitModeSelect.value === 'cover';
  cropPositionSection.style.display = isCover ? 'block' : 'none';
  updateCropUIForSource();
  refreshCurrentPreview();
});

// Dynamic Crop UI based on image aspect ratio and orientation
function updateCropUIForSource() {
  let sw = 0, sh = 0;
  if (!isVideo && loadedImage) {
    sw = loadedImage.width;
    sh = loadedImage.height;
  } else if (isVideo && processVideo.duration) {
    sw = processVideo.videoWidth || 128;
    sh = processVideo.videoHeight || 64;
  }
  if (!sw || !sh) return;

  const isRotated90 = currentRotation === 90 || currentRotation === 270;
  const effSw = isRotated90 ? sh : sw;
  const effSh = isRotated90 ? sw : sh;

  const w = currentWidth;
  const h = currentHeight;
  const overflowsVertical = (effSh / effSw) > (h / w);

  const val = parseInt(cropYSlider.value, 10);

  if (overflowsVertical) {
    // Vertical overflow (image is taller than display ratio)
    cropSliderLabel.textContent = 'Altura de Encuadre (Crop Vertical):';
    presetPosStart.textContent = 'Arriba';
    presetPosCenter.textContent = 'Centro';
    presetPosEnd.textContent = 'Abajo';
    cropSliderHint.textContent = 'Desplaza verticalmente la imagen recortada para enfocar caras, textos o detalles.';
    if (val === 0) cropYVal.textContent = 'Arriba (0%)';
    else if (val === 50) cropYVal.textContent = 'Centro (50%)';
    else if (val === 100) cropYVal.textContent = 'Abajo (100%)';
    else cropYVal.textContent = `${val}%`;
  } else {
    // Horizontal overflow (image is wider than display ratio)
    cropSliderLabel.textContent = 'Posición de Encuadre (Crop Horizontal):';
    presetPosStart.textContent = 'Izquierda';
    presetPosCenter.textContent = 'Centro';
    presetPosEnd.textContent = 'Derecha';
    cropSliderHint.textContent = 'Desplaza horizontalmente la imagen recortada para enfocar el elemento principal.';
    if (val === 0) cropYVal.textContent = 'Izquierda (0%)';
    else if (val === 50) cropYVal.textContent = 'Centro (50%)';
    else if (val === 100) cropYVal.textContent = 'Derecha (100%)';
    else cropYVal.textContent = `${val}%`;
  }
}

function updateResolutionMeta() {
  let sw = 0, sh = 0;
  if (!isVideo && loadedImage) {
    sw = loadedImage.width;
    sh = loadedImage.height;
  } else if (isVideo && processVideo.duration) {
    sw = processVideo.videoWidth;
    sh = processVideo.videoHeight;
  }
  if (!sw || !sh) return;

  if (currentRotation === 90 || currentRotation === 270) {
    metaRes.textContent = `${sw} x ${sh} px ➔ Rotado (${sh} x ${sw})`;
  } else if (currentRotation === 180) {
    metaRes.textContent = `${sw} x ${sh} px (180° Invertido)`;
  } else {
    metaRes.textContent = `${sw} x ${sh} px`;
  }
}

function refreshCurrentPreview() {
  if (!isVideo && loadedImage) {
    refreshImageDisplay();
  } else if (isVideo && processVideo.src) {
    drawFrameToScratch(processVideo);
    const xbm = convertCanvasToXBM(scratchCtx, currentWidth, currentHeight);
    renderXbmFrame(xbm);
  }
}

function setRotation(newRotation) {
  currentRotation = (newRotation % 360 + 360) % 360;
  rotationSelect.value = String(currentRotation);
  updateCropUIForSource();
  updateResolutionMeta();
  refreshCurrentPreview();
}

rotationSelect.addEventListener('change', () => {
  setRotation(parseInt(rotationSelect.value, 10));
});

btnRotateCcw.addEventListener('click', () => {
  setRotation(currentRotation - 90);
});

btnRotateCw.addEventListener('click', () => {
  setRotation(currentRotation + 90);
});

cropYSlider.addEventListener('input', () => {
  const val = parseInt(cropYSlider.value, 10);
  updateCropUIForSource();

  btnCropPresets.forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.val, 10) === val);
  });

  refreshCurrentPreview();
});

btnCropPresets.forEach(btn => {
  btn.addEventListener('click', () => {
    cropYSlider.value = btn.dataset.val;
    cropYSlider.dispatchEvent(new Event('input'));
  });
});

displayResSelect.addEventListener('change', () => {
  const [w, h] = displayResSelect.value.split('x').map(Number);
  initCanvas(w, h);
  refreshImageDisplay();
});

// Color picker for OLED simulation
colorDots.forEach(dot => {
  dot.addEventListener('click', () => {
    colorDots.forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    oledColor = dot.dataset.color;
    oledCanvas.style.filter = `drop-shadow(0 0 6px ${oledColor})`;
    if (extractedFrames.length > 0) {
      renderXbmFrame(extractedFrames[currentFrameIndex]);
    } else {
      drawWelcomeScreen();
    }
  });
});

// Drag and drop handlers
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

// Tabs logic
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    btn.classList.add('active');
    const tabId = `tab-${btn.dataset.tab}`;
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';
  });
});

// Video MAX Trimming Logic
function applyVideoMaxTrim() {
  if (!processVideo.duration) return;
  const fullSec = Math.floor(processVideo.duration);
  trimStart.value = 0;
  trimEnd.value = fullSec > 0 ? fullSec : processVideo.duration.toFixed(1);

  const fps = parseInt(fpsSelector.value, 10) || 10;
  const neededFrames = Math.ceil(parseFloat(trimEnd.value) * fps);
  if (parseInt(maxFramesInput.value, 10) < neededFrames) {
    maxFramesInput.value = neededFrames;
  }
  btnTrimMax.textContent = `MAX (${trimEnd.value}s)`;
  showToast(`Recorte ajustado a ${trimEnd.value}s`);
}

btnTrimMax.addEventListener('click', () => {
  applyVideoMaxTrim();
});

checkTrimMax.addEventListener('change', () => {
  if (checkTrimMax.checked && isVideo && processVideo.duration) {
    applyVideoMaxTrim();
  }
});

// Image Mode Switching (Static vs Luz y Sombras)
modeOptStatic.addEventListener('click', () => {
  imageMode = 'static';
  modeOptStatic.classList.add('active');
  modeOptAnim.classList.remove('active');
  animImageOptions.style.display = 'none';
  processBtn.querySelector('span').textContent = 'Convertir Imagen Fija';
  metaDuration.textContent = 'Imagen fija (1 fotograma)';
  if (loadedImage) {
    processSingleImage();
  }
});

modeOptAnim.addEventListener('click', () => {
  imageMode = 'anim';
  modeOptAnim.classList.add('active');
  modeOptStatic.classList.remove('active');
  animImageOptions.style.display = 'block';
  processBtn.querySelector('span').textContent = 'Generar Animación Luz y Sombras';
  metaDuration.textContent = `Bucle animado (~${imgAnimDuration.value}s)`;
  if (loadedImage) {
    generateLightShadowAnimation();
  }
});

btnGenerateAnim.addEventListener('click', () => {
  generateLightShadowAnimation();
});

imgAnimDuration.addEventListener('change', () => {
  if (imageMode === 'anim' && loadedImage) {
    metaDuration.textContent = `Bucle animado (~${imgAnimDuration.value}s)`;
    generateLightShadowAnimation();
  }
});

imgAnimFps.addEventListener('change', () => {
  if (imageMode === 'anim' && loadedImage) {
    generateLightShadowAnimation();
  }
});

imgAnimIntensity.addEventListener('change', () => {
  if (imageMode === 'anim' && loadedImage) {
    generateLightShadowAnimation();
  }
});

// File loader
function handleFile(file) {
  loadedFile = file;
  mediaMeta.style.display = 'block';
  metaName.textContent = file.name;
  stopPlayback();

  if (file.type.startsWith('video/')) {
    isVideo = true;
    imageControlsSection.style.display = 'none';
    videoControlsSection.style.display = 'block';
    processBtn.disabled = false;
    processBtn.querySelector('span').textContent = 'Procesar y Extraer Fotogramas de Video';

    const url = URL.createObjectURL(file);
    processVideo.src = url;
    processVideo.onloadedmetadata = () => {
      updateResolutionMeta();
      updateCropUIForSource();
      metaDuration.textContent = `${processVideo.duration.toFixed(1)} segundos`;
      trimStart.value = 0;

      const fullSec = Math.floor(processVideo.duration);
      btnTrimMax.textContent = `MAX (${fullSec}s)`;

      if (checkTrimMax.checked) {
        applyVideoMaxTrim();
      } else {
        trimEnd.value = Math.min(processVideo.duration, 5).toFixed(1);
      }

      trimEnd.max = processVideo.duration.toFixed(1);
      trimStart.max = processVideo.duration.toFixed(1);

      // Seek to first frame to preview
      processVideo.currentTime = 0;
    };
    processVideo.onseeked = () => {
      if (!isPlaying && extractedFrames.length === 0) {
        drawFrameToScratch(processVideo);
        const xbm = convertCanvasToXBM(scratchCtx, currentWidth, currentHeight);
        renderXbmFrame(xbm);
      }
    };
  } else if (file.type.startsWith('image/')) {
    isVideo = false;
    videoControlsSection.style.display = 'none';
    imageControlsSection.style.display = 'block';
    processBtn.disabled = false;
    processBtn.querySelector('span').textContent = imageMode === 'anim'
      ? 'Generar Animación Luz y Sombras'
      : 'Convertir Imagen Fija';

    const reader = new FileReader();
    reader.onload = (event) => {
      loadedImage = new Image();
      loadedImage.onload = () => {
        updateResolutionMeta();
        updateCropUIForSource();
        metaDuration.textContent = imageMode === 'anim' 
          ? `Bucle animado (~${imgAnimDuration.value}s)` 
          : 'Imagen fija (1 fotograma)';
        
        if (imageMode === 'anim') {
          generateLightShadowAnimation();
        } else {
          processSingleImage();
        }
      };
      loadedImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
}

// Single image conversion
function processSingleImage() {
  if (!loadedImage) return;
  stopPlayback();
  drawFrameToScratch(loadedImage);
  const xbm = convertCanvasToXBM(scratchCtx, currentWidth, currentHeight);
  extractedFrames = [xbm];
  currentFrameIndex = 0;
  scrubber.max = 0;
  scrubber.value = 0;
  frameCounter.textContent = 'Cuadro 1 / 1';
  renderXbmFrame(xbm);
  updateStats();
  generateArduinoCode();
}

// Image Luz y Sombras 3s animation generator
function generateLightShadowAnimation() {
  if (!loadedImage) return;
  stopPlayback();

  const duration = parseFloat(imgAnimDuration.value) || 3.0;
  const fps = parseInt(imgAnimFps.value, 10) || 10;
  const intensity = parseInt(imgAnimIntensity.value, 10) || 45;
  const totalFrames = Math.max(10, Math.round(duration * fps));
  const baseThreshold = parseInt(thresholdSlider.value, 10);

  // Draw image to scratch canvas once
  drawFrameToScratch(loadedImage);

  extractedFrames = [];

  for (let i = 0; i < totalFrames; i++) {
    // Sinusoidal wave: starts at 0, goes up to +intensity, crosses 0, goes down to -intensity, returns to 0
    // Perfectly seamless loop!
    const angle = (i / totalFrames) * 2 * Math.PI;
    const waveOffset = Math.round(intensity * Math.sin(angle));
    const currentThresh = Math.max(10, Math.min(245, baseThreshold + waveOffset));

    const xbm = convertCanvasToXBM(scratchCtx, currentWidth, currentHeight, currentThresh);
    extractedFrames.push(xbm);
  }

  scrubber.max = extractedFrames.length - 1;
  scrubber.value = 0;
  currentFrameIndex = 0;
  updateFrameIndicator();
  updateStats();
  generateArduinoCode();
  renderXbmFrame(extractedFrames[0]);
  startPlayback();
  showToast(`¡Animación "Luz y Sombras" generada (${totalFrames} cuadros / ${duration}s)!`);
}

// Process Video / Image Button click
processBtn.addEventListener('click', async () => {
  if (!loadedFile) return;
  if (!isVideo) {
    if (imageMode === 'anim') {
      generateLightShadowAnimation();
    } else {
      processSingleImage();
    }
    return;
  }
  await processVideoFrames();
});

// Video frame extractor
async function processVideoFrames() {
  stopPlayback();
  processBtn.disabled = true;
  const start = Math.max(0, parseFloat(trimStart.value) || 0);
  const end = Math.min(processVideo.duration, parseFloat(trimEnd.value) || processVideo.duration);
  const fps = parseInt(fpsSelector.value, 10);
  const maxLimit = parseInt(maxFramesInput.value, 10) || 100;

  const duration = Math.max(0.1, end - start);
  const totalFrames = Math.min(maxLimit, Math.floor(duration * fps));
  const timeStep = duration / totalFrames;

  extractedFrames = [];
  processBtn.querySelector('span').textContent = `Extrayendo fotogramas (0/${totalFrames})...`;

  for (let i = 0; i < totalFrames; i++) {
    const targetTime = start + (i * timeStep);
    await seekVideo(targetTime);
    drawFrameToScratch(processVideo);
    const xbm = convertCanvasToXBM(scratchCtx, currentWidth, currentHeight);
    extractedFrames.push(xbm);
    renderXbmFrame(xbm);
    processBtn.querySelector('span').textContent = `Extrayendo (${i + 1}/${totalFrames})...`;
  }

  processBtn.disabled = false;
  processBtn.querySelector('span').textContent = '¡Proceso Completado! Extraer de nuevo';

  scrubber.max = extractedFrames.length - 1;
  scrubber.value = 0;
  currentFrameIndex = 0;
  updateFrameIndicator();
  updateStats();
  generateArduinoCode();
  startPlayback();
}

function seekVideo(time) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      processVideo.removeEventListener('seeked', onSeeked);
      resolve();
    };
    processVideo.addEventListener('seeked', onSeeked);
    processVideo.currentTime = time;
  });
}

// Draw to scratch canvas with scaling mode and orientation rotation
function drawFrameToScratch(source) {
  const w = currentWidth;
  const h = currentHeight;
  scratchCtx.fillStyle = '#000000';
  scratchCtx.fillRect(0, 0, w, h);

  const sw = source.videoWidth || source.width;
  const sh = source.videoHeight || source.height;
  if (!sw || !sh) return;

  const isRotated90 = currentRotation === 90 || currentRotation === 270;
  const effSw = isRotated90 ? sh : sw;
  const effSh = isRotated90 ? sw : sh;
  const fit = fitModeSelect.value;

  let dw, dh, dx, dy;

  if (fit === 'stretch') {
    dw = w;
    dh = h;
    dx = 0;
    dy = 0;
  } else if (fit === 'contain') {
    const scale = Math.min(w / effSw, h / effSh);
    dw = effSw * scale;
    dh = effSh * scale;
    dx = (w - dw) / 2;
    dy = (h - dh) / 2;
  } else if (fit === 'cover') {
    const scale = Math.max(w / effSw, h / effSh);
    dw = effSw * scale;
    dh = effSh * scale;

    const cropRatio = (cropYSlider ? parseInt(cropYSlider.value, 10) : 50) / 100;

    if (dh > h) {
      dy = (h - dh) * cropRatio;
      dx = (w - dw) / 2;
    } else if (dw > w) {
      dx = (w - dw) * cropRatio;
      dy = (h - dh) / 2;
    } else {
      dx = (w - dw) / 2;
      dy = (h - dh) / 2;
    }
  }

  // Draw with rotation around the target bounding box center
  const cx = dx + dw / 2;
  const cy = dy + dh / 2;

  scratchCtx.save();
  scratchCtx.translate(cx, cy);
  scratchCtx.rotate((currentRotation * Math.PI) / 180);

  if (isRotated90) {
    scratchCtx.drawImage(source, -dh / 2, -dw / 2, dh, dw);
  } else {
    scratchCtx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
  }

  scratchCtx.restore();
}

function getEffectiveFps() {
  if (!isVideo && imageMode === 'anim') {
    return parseInt(imgAnimFps.value, 10) || 10;
  }
  return parseInt(fpsSelector.value, 10) || 10;
}

/**
 * Core Binarization & XBM Format Converter
 * Converts 128x64 Canvas to XBM standard byte array (LSB first per byte)
 */
function convertCanvasToXBM(ctx, width, height, customThreshold = null) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const threshold = customThreshold !== null ? customThreshold : parseInt(thresholdSlider.value, 10);
  const inverted = invertCheck.checked;
  const ditherMode = ditherModeSelect.value;

  // 2D luminance array (0..255)
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) {
    const idx = i * 4;
    // Standard perceptual luminance formula
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Binary pixel matrix (1 = OLED ON, 0 = OLED OFF)
  const binary = new Uint8Array(width * height);

  if (ditherMode === 'floyd') {
    // Floyd-Steinberg error diffusion
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = lum[idx];
        const newVal = oldVal >= threshold ? 255 : 0;
        const err = oldVal - newVal;

        binary[idx] = inverted ? (newVal === 0 ? 1 : 0) : (newVal === 255 ? 1 : 0);

        // Distribute error
        if (x + 1 < width) lum[idx + 1] += err * (7 / 16);
        if (x - 1 >= 0 && y + 1 < height) lum[idx + width - 1] += err * (3 / 16);
        if (y + 1 < height) lum[idx + width] += err * (5 / 16);
        if (x + 1 < width && y + 1 < height) lum[idx + width + 1] += err * (1 / 16);
      }
    }
  } else if (ditherMode === 'atkinson') {
    // Atkinson dithering (classic retro Apple Mac look)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = lum[idx];
        const newVal = oldVal >= threshold ? 255 : 0;
        const err = Math.floor((oldVal - newVal) / 8);

        binary[idx] = inverted ? (newVal === 0 ? 1 : 0) : (newVal === 255 ? 1 : 0);

        if (x + 1 < width) lum[idx + 1] += err;
        if (x + 2 < width) lum[idx + 2] += err;
        if (x - 1 >= 0 && y + 1 < height) lum[idx + width - 1] += err;
        if (y + 1 < height) lum[idx + width] += err;
        if (x + 1 < width && y + 1 < height) lum[idx + width + 1] += err;
        if (y + 2 < height) lum[idx + width * 2] += err;
      }
    }
  } else {
    // Direct Threshold
    for (let i = 0; i < lum.length; i++) {
      const isLit = lum[i] >= threshold;
      binary[i] = inverted ? (!isLit ? 1 : 0) : (isLit ? 1 : 0);
    }
  }

  // Pack into XBM format:
  // 8 pixels per byte, Least Significant Bit (bit 0) = leftmost pixel!
  const bytesPerRow = Math.ceil(width / 8);
  const totalBytes = bytesPerRow * height;
  const xbmBytes = new Uint8Array(totalBytes);

  for (let y = 0; y < height; y++) {
    for (let byteCol = 0; byteCol < bytesPerRow; byteCol++) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteCol * 8 + bit;
        if (x < width) {
          const pixel = binary[y * width + x];
          if (pixel === 1) {
            b |= (1 << bit);
          }
        }
      }
      xbmBytes[y * bytesPerRow + byteCol] = b;
    }
  }

  return xbmBytes;
}

// Render XBM Byte array back to OLED simulation canvas
function renderXbmFrame(xbmBytes) {
  if (!xbmBytes) return;
  const w = currentWidth;
  const h = currentHeight;
  const bytesPerRow = Math.ceil(w / 8);

  const imgData = oledCtx.createImageData(w, h);
  const data = imgData.data;

  // Parse color hex into RGB
  const rgb = hexToRgb(oledColor);

  for (let y = 0; y < h; y++) {
    for (let byteCol = 0; byteCol < bytesPerRow; byteCol++) {
      const byteVal = xbmBytes[y * bytesPerRow + byteCol];
      for (let bit = 0; bit < 8; bit++) {
        const x = byteCol * 8 + bit;
        if (x < w) {
          const pixelIndex = (y * w + x) * 4;
          const isLit = (byteVal & (1 << bit)) !== 0;

          if (isLit) {
            data[pixelIndex] = rgb.r;
            data[pixelIndex + 1] = rgb.g;
            data[pixelIndex + 2] = rgb.b;
            data[pixelIndex + 3] = 255;
          } else {
            // OLED deep black
            data[pixelIndex] = 2;
            data[pixelIndex + 1] = 4;
            data[pixelIndex + 2] = 6;
            data[pixelIndex + 3] = 255;
          }
        }
      }
    }
  }
  oledCtx.putImageData(imgData, 0, 0);
}

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Playback engine
function startPlayback(customFps = null) {
  if (extractedFrames.length <= 1) return;
  isPlaying = true;
  playIcon.style.display = 'none';
  pauseIcon.style.display = 'block';

  const fps = customFps || getEffectiveFps();
  const intervalMs = Math.round(1000 / fps);

  clearInterval(playInterval);
  playInterval = setInterval(() => {
    currentFrameIndex = (currentFrameIndex + 1) % extractedFrames.length;
    scrubber.value = currentFrameIndex;
    updateFrameIndicator();
    renderXbmFrame(extractedFrames[currentFrameIndex]);
  }, intervalMs);
}

function stopPlayback() {
  isPlaying = false;
  clearInterval(playInterval);
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
}

playPauseBtn.addEventListener('click', () => {
  if (extractedFrames.length <= 1) return;
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
});

scrubber.addEventListener('input', () => {
  if (extractedFrames.length === 0) return;
  stopPlayback();
  currentFrameIndex = parseInt(scrubber.value, 10);
  updateFrameIndicator();
  renderXbmFrame(extractedFrames[currentFrameIndex]);
});

function updateFrameIndicator() {
  frameCounter.textContent = `Cuadro ${currentFrameIndex + 1} / ${extractedFrames.length}`;
}

// Stats & Memory Calculation
function updateStats() {
  const count = extractedFrames.length;
  const bytesPerFrame = Math.ceil(currentWidth / 8) * currentHeight;
  const totalBytes = count * bytesPerFrame;
  const totalKb = (totalBytes / 1024).toFixed(1);

  // ESP32-S3 N16R8 has 16MB Flash = 16,777,216 bytes
  const espFlashBytes = 16 * 1024 * 1024;
  const pct = ((totalBytes / espFlashBytes) * 100).toFixed(2);

  const fps = getEffectiveFps();
  const animTime = count > 0 ? (count / fps).toFixed(1) : '0.0';

  statFrames.textContent = count;
  statSize.textContent = `${totalKb} KB`;
  statFlashPct.textContent = `${pct}% / 16MB`;
  statAnimTime.textContent = `${animTime}s`;
}

/**
 * Arduino C++ / U8g2 Code Generator
 * Preconfigured for ESP32-S3 N16R8 + SH1106 I2C (Pins: SDA=8, SCL=13)
 */
function generateArduinoCode() {
  if (extractedFrames.length === 0) return;

  const count = extractedFrames.length;
  const w = currentWidth;
  const h = currentHeight;
  const bytesPerFrame = Math.ceil(w / 8) * h;
  const fps = getEffectiveFps();
  const frameDelay = Math.round(1000 / fps);

  // Build frames.h content
  let hCode = `// =========================================================================\n`;
  hCode += `// OLED XBM Bitmaps Generados para ESP32-S3 (16MB Flash / 8MB PSRAM)\n`;
  hCode += `// Pantalla: SH1106 1.3" I2C (${w}x${h}) | Libreria: U8g2\n`;
  hCode += `// Total fotogramas: ${count} | Tamano por cuadro: ${bytesPerFrame} bytes\n`;
  hCode += `// =========================================================================\n\n`;
  hCode += `#ifndef OLED_FRAMES_H\n`;
  hCode += `#define OLED_FRAMES_H\n\n`;
  hCode += `#include <Arduino.h>\n\n`;
  hCode += `#define FRAME_WIDTH  ${w}\n`;
  hCode += `#define FRAME_HEIGHT ${h}\n`;
  hCode += `#define FRAME_COUNT  ${count}\n`;
  hCode += `#define FRAME_DELAY  ${frameDelay} // ms (${fps} FPS)\n\n`;

  // Write each frame array
  for (let i = 0; i < count; i++) {
    hCode += `// Cuadro ${i + 1}/${count}\n`;
    hCode += `const unsigned char frame_${i}[${bytesPerFrame}] PROGMEM = {\n  `;
    const frameData = extractedFrames[i];
    const hexArray = [];
    for (let b = 0; b < frameData.length; b++) {
      hexArray.push('0x' + frameData[b].toString(16).padStart(2, '0'));
    }

    // Wrap in rows of 16 bytes
    for (let r = 0; r < hexArray.length; r += 16) {
      const slice = hexArray.slice(r, r + 16);
      hCode += slice.join(', ');
      if (r + 16 < hexArray.length) {
        hCode += ',\n  ';
      }
    }
    hCode += '\n};\n\n';
  }

  // Master pointer array
  hCode += `// Indice de cuadros en PROGMEM\n`;
  hCode += `const unsigned char* const epd_bitmap_allArray[FRAME_COUNT] PROGMEM = {\n`;
  for (let i = 0; i < count; i++) {
    hCode += `  frame_${i}${i < count - 1 ? ',' : ''}\n`;
  }
  hCode += `};\n\n`;
  hCode += `#endif // OLED_FRAMES_H\n`;

  codeHOutput.value = hCode;

  // Build complete .ino Sketch
  let inoCode = `/*\n`;
  inoCode += ` * Reproductor de Animacion / Video OLED para ESP32-S3 N16R8\n`;
  inoCode += ` * Pantalla: OLED 1.3" SH1106 I2C 128x64\n`;
  inoCode += ` * Libreria: U8g2 by olikraus\n`;
  inoCode += ` * Conexiones de Pines:\n`;
  inoCode += ` *   - OLED SDA -> ESP32-S3 GPIO 8\n`;
  inoCode += ` *   - OLED SCK -> ESP32-S3 GPIO 13 (o GPIO 9)\n`;
  inoCode += ` *   - OLED VCC -> ESP32-S3 3.3V\n`;
  inoCode += ` *   - OLED GND -> ESP32-S3 GND\n`;
  inoCode += ` */\n\n`;
  inoCode += `#include <Wire.h>\n`;
  inoCode += `#include <U8g2lib.h>\n`;
  inoCode += `#include "frames.h"\n\n`;
  inoCode += `// Definicion de pines I2C configurados para tu conexion\n`;
  inoCode += `#define OLED_SDA 8\n`;
  inoCode += `#define OLED_SCL 13\n\n`;
  inoCode += `// Constructor SH1106 I2C por Hardware en buffer completo (Full Buffer _F_)\n`;
  inoCode += `// Para SH1106 128x64:\n`;
  inoCode += `U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);\n\n`;
  inoCode += `int currentFrame = 0;\n\n`;
  inoCode += `void setup() {\n`;
  inoCode += `  Serial.begin(115200);\n`;
  inoCode += `  delay(500);\n`;
  inoCode += `  Serial.println("Iniciando ESP32-S3 OLED Video Player...");\n\n`;
  inoCode += `  // Iniciar bus I2C con tus pines personalizados (SDA=8, SCL=13)\n`;
  inoCode += `  Wire.begin(OLED_SDA, OLED_SCL);\n`;
  inoCode += `  // Acelerar bus a 400kHz (Fast Mode) para maxima tasa de cuadros\n`;
  inoCode += `  Wire.setClock(400000);\n\n`;
  inoCode += `  // Iniciar U8g2\n`;
  inoCode += `  u8g2.begin();\n`;
  inoCode += `  u8g2.clearBuffer();\n`;
  inoCode += `  u8g2.setFont(u8g2_font_ncenB08_tr);\n`;
  inoCode += `  u8g2.drawStr(10, 36, "Cargando Video...");\n`;
  inoCode += `  u8g2.sendBuffer();\n`;
  inoCode += `  delay(1000);\n`;
  inoCode += `}\n\n`;
  inoCode += `void loop() {\n`;
  inoCode += `  // Limpiar buffer de pantalla\n`;
  inoCode += `  u8g2.clearBuffer();\n\n`;
  inoCode += `  // Dibujar cuadro XBM actual\n`;
  inoCode += `  // drawXBMP lee directamente desde la memoria Flash (PROGMEM)\n`;
  inoCode += `  u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, epd_bitmap_allArray[currentFrame]);\n\n`;
  inoCode += `  // Enviar a la pantalla OLED SH1106\n`;
  inoCode += `  u8g2.sendBuffer();\n\n`;
  inoCode += `  // Avanzar cuadro en bucle continuo\n`;
  inoCode += `  currentFrame++;\n`;
  inoCode += `  if (currentFrame >= FRAME_COUNT) {\n`;
  inoCode += `    currentFrame = 0;\n`;
  inoCode += `  }\n\n`;
  inoCode += `  // Tiempo de espera segun FPS configurados\n`;
  inoCode += `  delay(FRAME_DELAY);\n`;
  inoCode += `}\n`;

  codeInoOutput.value = inoCode;
}

// Copy to clipboard helpers
copyInoBtn.addEventListener('click', () => {
  if (!codeInoOutput.value) return;
  navigator.clipboard.writeText(codeInoOutput.value).then(() => {
    showToast('Código .ino copiado al portapapeles');
  });
});

copyHBtn.addEventListener('click', () => {
  if (!codeHOutput.value) return;
  navigator.clipboard.writeText(codeHOutput.value).then(() => {
    showToast('Arreglo frames.h copiado al portapapeles');
  });
});

// Download files helpers
downloadInoBtn.addEventListener('click', () => {
  if (!codeInoOutput.value) return;
  downloadTextFile('video_oled.ino', codeInoOutput.value);
});

downloadHBtn.addEventListener('click', () => {
  if (!codeHOutput.value) return;
  downloadTextFile('frames.h', codeHOutput.value);
});

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Descargado: ${filename}`);
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// Tab Switching Handler
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const targetTabId = `tab-${btn.dataset.tab}`;
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = content.id === targetTabId ? 'block' : 'none';
    });
  });
});

// =========================================================================
// Web Serial ESP32 Flasher Integration (esptool-js)
// =========================================================================

const btnFlashEsp = document.getElementById('btn-flash-esp');
const btnFlashCancel = document.getElementById('btn-flash-cancel');
const btnToggleTerminal = document.getElementById('btn-toggle-terminal');
const btnClearTerminal = document.getElementById('btn-clear-terminal');
const terminalDrawer = document.getElementById('terminal-drawer');
const flasherTerminal = document.getElementById('flasher-terminal');
const flasherProgressBox = document.getElementById('flasher-progress-box');
const flasherProgressBar = document.getElementById('flasher-progress-bar');
const flasherStatusLabel = document.getElementById('flasher-status-label');
const flasherPctLabel = document.getElementById('flasher-pct-label');
const modeFlashFull = document.getElementById('mode-flash-full');
const modeFlashVideoOnly = document.getElementById('mode-flash-video-only');
const serialSupportBanner = document.getElementById('serial-support-banner');

let activeTransport = null;
let isFlashing = false;
let esptoolModules = null;

// Dynamic loader for esptool-js
async function loadEsptool() {
  if (esptoolModules) return esptoolModules;
  try {
    const mod = await import('./esptool-bundle.js');
    esptoolModules = { ESPLoader: mod.ESPLoader, Transport: mod.Transport };
    return esptoolModules;
  } catch (err) {
    console.warn("Fallo carga local de esptool-bundle.js, intentando desde CDN...", err);
    const mod = await import('https://unpkg.com/esptool-js@0.5.4/bundle.js');
    esptoolModules = { ESPLoader: mod.ESPLoader, Transport: mod.Transport };
    return esptoolModules;
  }
}

// Check Serial Support
function checkSerialSupport() {
  if ('serial' in navigator) {
    serialSupportBanner.className = 'flasher-banner ok';
    serialSupportBanner.innerHTML = `<span>✅ <strong>Navegador Compatible:</strong> Web Serial API lista. Conecta tu ESP32 por USB y presiona el botón.</span>`;
  } else {
    serialSupportBanner.className = 'flasher-banner warning';
    serialSupportBanner.innerHTML = `<span>⚠️ <strong>Navegador no compatible:</strong> Tu navegador no soporta Web Serial API. Para grabar directamente por USB, por favor abre este sitio en <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>.</span>`;
    btnFlashEsp.disabled = true;
    btnFlashEsp.style.opacity = '0.5';
  }
}
checkSerialSupport();

// Flashing Mode selection
modeFlashFull.addEventListener('click', () => {
  modeFlashFull.classList.add('active');
  modeFlashVideoOnly.classList.remove('active');
  modeFlashFull.querySelector('input').checked = true;
});

modeFlashVideoOnly.addEventListener('click', () => {
  modeFlashVideoOnly.classList.add('active');
  modeFlashFull.classList.remove('active');
  modeFlashVideoOnly.querySelector('input').checked = true;
});

// Toggle Terminal
btnToggleTerminal.addEventListener('click', () => {
  const isHidden = terminalDrawer.style.display === 'none';
  terminalDrawer.style.display = isHidden ? 'block' : 'none';
  btnToggleTerminal.textContent = isHidden ? 'Ocultar Consola Serial' : 'Mostrar Consola Serial';
});

btnClearTerminal.addEventListener('click', () => {
  flasherTerminal.textContent = '';
});

// Terminal Logger
const flasherTerminalLogger = {
  clean() {
    flasherTerminal.textContent = '';
  },
  writeLine(text) {
    flasherTerminal.textContent += text + '\n';
    flasherTerminal.scrollTop = flasherTerminal.scrollHeight;
  },
  write(text) {
    flasherTerminal.textContent += text;
    flasherTerminal.scrollTop = flasherTerminal.scrollHeight;
  }
};

function updateFlasherStatus(status, pct) {
  flasherStatusLabel.textContent = status;
  flasherPctLabel.textContent = `${pct}%`;
  flasherProgressBar.style.width = `${pct}%`;
}

// Build custom video_data.bin block
function buildVideoBinary(frames, width, height, fps) {
  const bytesPerFrame = Math.ceil(width / 8) * height; // 1024 bytes
  const headerSize = 12;
  const totalSize = headerSize + (frames.length * bytesPerFrame);
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  // Magic "VIDE" (Little Endian: 'V'=0x56, 'I'=0x49, 'D'=0x44, 'E'=0x45)
  buffer[0] = 0x56;
  buffer[1] = 0x49;
  buffer[2] = 0x44;
  buffer[3] = 0x45;

  view.setUint16(4, frames.length, true);
  const delayMs = Math.round(1000 / fps);
  view.setUint16(6, delayMs, true);
  buffer[8] = width;
  buffer[9] = height;
  view.setUint16(10, 0, true);

  let offset = headerSize;
  for (let i = 0; i < frames.length; i++) {
    buffer.set(frames[i], offset);
    offset += bytesPerFrame;
  }
  return buffer;
}

function uint8ArrayToBinaryString(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return binary;
}

// Flash ESP32 via Web Serial
btnFlashEsp.addEventListener('click', async () => {
  if (isFlashing) return;

  if (extractedFrames.length === 0) {
    alert('Primero debes cargar y procesar un video o imagen antes de flashear el ESP32.');
    return;
  }

  try {
    isFlashing = true;
    btnFlashEsp.disabled = true;
    flasherProgressBox.style.display = 'block';
    updateFlasherStatus('Cargando motor de flasheo Web Serial...', 5);
    flasherTerminalLogger.writeLine('[INFO] Cargando esptool-js...');

    const { ESPLoader, Transport } = await loadEsptool();

    updateFlasherStatus('Por favor selecciona tu puerto USB en la ventana...', 10);
    flasherTerminalLogger.writeLine('[INFO] Solicitando puerto serie al usuario...');

    const port = await navigator.serial.requestPort({});
    const transport = new Transport(port, true);
    activeTransport = transport;

    const espLoader = new ESPLoader({
      transport: transport,
      baudrate: 460800,
      terminal: flasherTerminalLogger,
      romBaudrate: 115200
    });

    updateFlasherStatus('Conectando al ESP32 (Sincronizando Bootloader)...', 18);
    flasherTerminalLogger.writeLine('[INFO] Estableciendo conexión con el microcontrolador...');

    const chip = await espLoader.main();
    flasherTerminalLogger.writeLine(`[OK] Chip detectado exitosamente: ${chip}`);

    const isFull = document.querySelector('input[name="flash-type"]:checked').value === 'full';
    const fileArray = [];

    if (isFull) {
      updateFlasherStatus('Descargando firmware base...', 25);
      flasherTerminalLogger.writeLine('[INFO] Descargando bootloader, partitions y firmware base...');

      const [bootResp, partResp, firmResp] = await Promise.all([
        fetch('firmware/bootloader.bin'),
        fetch('firmware/partitions.bin'),
        fetch('firmware/firmware.bin')
      ]);

      if (!bootResp.ok || !partResp.ok || !firmResp.ok) {
        throw new Error('No se pudieron descargar los binarios del firmware base.');
      }

      const bootBytes = new Uint8Array(await bootResp.arrayBuffer());
      const partBytes = new Uint8Array(await partResp.arrayBuffer());
      const firmBytes = new Uint8Array(await firmResp.arrayBuffer());

      fileArray.push({ data: uint8ArrayToBinaryString(bootBytes), address: 0x0000 });
      fileArray.push({ data: uint8ArrayToBinaryString(partBytes), address: 0x8000 });
      fileArray.push({ data: uint8ArrayToBinaryString(firmBytes), address: 0x10000 });
      flasherTerminalLogger.writeLine(`[OK] Firmware base listo (Total: ${(firmBytes.length / 1024).toFixed(1)} KB)`);
    }

    // Prepare video binary
    updateFlasherStatus('Generando bloque de video...', 35);
    const fps = getEffectiveFps();
    const videoBytes = buildVideoBinary(extractedFrames, currentWidth, currentHeight, fps);
    fileArray.push({ data: uint8ArrayToBinaryString(videoBytes), address: 0x200000 });
    flasherTerminalLogger.writeLine(`[OK] Datos de video empaquetados (${(videoBytes.length / 1024).toFixed(1)} KB, ${extractedFrames.length} cuadros, offset 0x200000)`);

    // Write flash
    updateFlasherStatus('Escribiendo en memoria Flash...', 40);
    flasherTerminalLogger.writeLine('[INFO] Iniciando escritura en memoria Flash...');

    await espLoader.writeFlash({
      fileArray: fileArray,
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const fileProgress = written / total;
        const overall = Math.min(98, Math.round(40 + ((fileIndex + fileProgress) / fileArray.length) * 58));
        updateFlasherStatus(`Escribiendo archivo ${fileIndex + 1}/${fileArray.length} (${overall}%)...`, overall);
      }
    });

    flasherTerminalLogger.writeLine('[OK] ¡Flasheo completado con éxito!');
    updateFlasherStatus('¡Flasheo completado! Reiniciando ESP32...', 99);

    // Intentar reinicio automático a modo aplicación
    try {
      if (typeof espLoader.after === 'function') {
        await espLoader.after('hard_reset');
      }
    } catch (resetErr) {
      console.warn('Reinicio automático por after():', resetErr);
    }

    // Pulso RTS/DTR adicional
    try {
      if (transport) {
        await transport.setDTR(false);
        await transport.setRTS(true);
        await new Promise(r => setTimeout(r, 100));
        await transport.setRTS(false);
      }
    } catch (pulseErr) {
      console.warn('Pulso RTS:', pulseErr);
    }

    // Desconectar puerto serie
    try {
      await transport.disconnect();
    } catch (discErr) {}
    activeTransport = null;

    updateFlasherStatus('¡Flasheo completado! Reproduciendo video.', 100);
    flasherTerminalLogger.writeLine('[OK] Proceso finalizado al 100%.');
    flasherTerminalLogger.writeLine('[INFO] Si tu ESP32 no arranca de inmediato, presiona el botón RST / EN de la placa.');
    showToast('¡Flasheo exitoso! Si no inicia solo, presiona el botón RST del ESP32.');

  } catch (err) {
    console.error('Error durante el flasheo:', err);
    flasherTerminalLogger.writeLine(`[ERROR] ${err.message || err}`);
    if (err.name === 'NotFoundError') {
      showToast('Selección de puerto cancelada.');
    } else {
      alert(`Ocurrió un error al flashear el ESP32: ${err.message || err}`);
    }
  } finally {
    isFlashing = false;
    btnFlashEsp.disabled = false;
    if (activeTransport) {
      try { await activeTransport.disconnect(); } catch (e) {}
      activeTransport = null;
    }
  }
});
