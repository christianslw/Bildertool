// compression.worker.js
// Web Worker für JPEG-Komprimierung via OffscreenCanvas.
// Empfängt: { id, arrayBuffer, targetBytes }
// Sendet:   { id, blob } oder { id, error }

self.onmessage = async (e) => {
    const { id, arrayBuffer, targetBytes } = e.data;
    try {
        const blob = await compressBuffer(arrayBuffer, targetBytes || 1_000_000);
        self.postMessage({ id, blob }, []);
    } catch (err) {
        self.postMessage({ id, error: String(err) });
    }
};

async function compressBuffer(arrayBuffer, targetBytes) {
    const imgBlob = new Blob([arrayBuffer], { type: 'image/jpeg' });
    const bitmap = await createImageBitmap(imgBlob);

    let width = bitmap.width;
    let height = bitmap.height;
    const maxSide = 2200;
    if (Math.max(width, height) > maxSide) {
        const ratio = maxSide / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let quality = 0.9;
    let result = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    while (result.size > targetBytes && quality > 0.35) {
        quality -= 0.1;
        result = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    return result;
}
