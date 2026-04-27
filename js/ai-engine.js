/** =========================================================================
 * MODUL: BROWSER-SIDE ONNX INFERENCE (replaces Python embedder.py)
 * Uses onnxruntime-web (WASM) – no server required.
 * ========================================================================= */

const MODEL_PATH = 'models/onnx/model_quantized.onnx';

// ImageNet normalization constants (must match Python preprocess.py)
const MEAN = [0.485, 0.456, 0.406];
const STD  = [0.229, 0.224, 0.225];
const IMAGE_SIZE   = 224;
const RESIZE_SHORT = 256;
const EMBEDDING_DIM = 384;

let _ortSession = null;
let _ortLoadPromise = null;

/** Load onnxruntime-web session (cached, loads once) */
async function _ensureOrtSession() {
    if (_ortSession) return _ortSession;
    if (_ortLoadPromise) return _ortLoadPromise;

    _ortLoadPromise = (async () => {
        if (!window.ort) throw new Error('onnxruntime-web not loaded');

        // Use WASM backend only (works offline, no GPU required)
        ort.env.wasm.numThreads = navigator.hardwareConcurrency > 2 ? 2 : 1;

        _ortSession = await ort.InferenceSession.create(MODEL_PATH, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
        });
        return _ortSession;
    })();

    return _ortLoadPromise;
}

/** Resize image so shortest side = targetShort, then center-crop to size×size.
 *  Mirrors Python resize_short_side + center_crop. */
function _preprocessToCanvas(imgElement, size, resizeShort) {
    const { naturalWidth: sw, naturalHeight: sh } = imgElement;
    let rw, rh;
    if (sw < sh) { rw = resizeShort; rh = Math.round(sh * resizeShort / sw); }
    else          { rh = resizeShort; rw = Math.round(sw * resizeShort / sh); }

    const offscreen = new OffscreenCanvas(rw, rh);
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, rw, rh);

    // Center crop
    const left = Math.max(0, Math.floor((rw - size) / 2));
    const top  = Math.max(0, Math.floor((rh - size) / 2));
    return ctx.getImageData(left, top, size, size);
}

/** Convert ImageData → Float32Array tensor [1, 3, H, W], normalized */
function _imageDataToTensor(imageData, size) {
    const { data } = imageData; // RGBA uint8
    const tensor = new Float32Array(3 * size * size);
    const stride = size * size;

    for (let i = 0; i < size * size; i++) {
        tensor[0 * stride + i] = (data[i * 4 + 0] / 255 - MEAN[0]) / STD[0]; // R
        tensor[1 * stride + i] = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1]; // G
        tensor[2 * stride + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2]; // B
    }
    return tensor;
}

/** L2-normalize a Float32Array in-place */
function _l2Normalize(vec) {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return vec;
}

/** Load a File/Blob as an HTMLImageElement */
function _fileToImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload  = () => { resolve(img); URL.revokeObjectURL(url); };
        img.onerror = () => { reject(new Error('Image decode failed')); URL.revokeObjectURL(url); };
        img.src = url;
    });
}

/**
 * Embed an image File/Blob → Float32Array of length EMBEDDING_DIM.
 * This is the browser equivalent of embedder.py:embed_image_bytes()
 */
async function embedImageFile(file) {
    const session = await _ensureOrtSession();
    const img = await _fileToImage(file);
    const imageData = _preprocessToCanvas(img, IMAGE_SIZE, RESIZE_SHORT);
    const tensorData = _imageDataToTensor(imageData, IMAGE_SIZE);

    const inputName = session.inputNames[0];
    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);
    const results = await session.run({ [inputName]: inputTensor });

    const outputName = session.outputNames[0];
    let raw = results[outputName].data; // Float32Array

    // Handle ViT output shapes: [1, tokens, dim] → CLS token, or [1, dim]
    const dims = results[outputName].dims;
    if (dims.length === 3) {
        // CLS token is index 0 along token axis
        raw = raw.slice(0, dims[2]);
    } else if (dims.length === 2) {
        raw = raw.slice(0, dims[1]);
    }

    // Trim or pad to configured EMBEDDING_DIM (matches Python behavior)
    let vec = new Float32Array(EMBEDDING_DIM);
    vec.set(raw.slice(0, EMBEDDING_DIM));

    return _l2Normalize(vec);
}

/** Returns true once the ONNX session is loaded and ready */
async function isAiEngineReady() {
    try {
        await _ensureOrtSession();
        return true;
    } catch {
        return false;
    }
}

/** Warm up the engine (call once at startup so first inference isn't slow) */
async function warmupAiEngine() {
    try {
        const session = await _ensureOrtSession();
        // Run a dummy inference with a blank image
        const inputName = session.inputNames[0];
        const dummy = new ort.Tensor('float32', new Float32Array(3 * IMAGE_SIZE * IMAGE_SIZE), [1, 3, IMAGE_SIZE, IMAGE_SIZE]);
        await session.run({ [inputName]: dummy });
        return true;
    } catch (err) {
        console.warn('[ai-engine] warmup failed:', err);
        return false;
    }
}
