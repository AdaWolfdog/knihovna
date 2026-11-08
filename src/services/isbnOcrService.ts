import { createWorker, type Worker } from 'tesseract.js';
import { normalizeIsbn } from './isbnService';

/**
 * Validates checksum of an ISBN-10 or ISBN-13 string.
 */
export function isValidIsbnChecksum(rawIsbn: string): boolean {
  const clean = normalizeIsbn(rawIsbn);

  // Validate ISBN-13
  if (clean.length === 13) {
    if (!/^\d{13}$/.test(clean)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(clean[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(clean[12], 10);
  }

  // Validate ISBN-10
  if (clean.length === 10) {
    if (!/^\d{9}[\dX]$/i.test(clean)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(clean[i], 10) * (10 - i);
    }
    const lastChar = clean[9].toUpperCase();
    const checkValue = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
    sum += checkValue;
    return sum % 11 === 0;
  }

  return false;
}

/**
 * Extracts a valid ISBN (10 or 13 digits) from arbitrary OCR text.
 * Searches both for explicitly prefixed forms (e.g. "ISBN 978-80-...")
 * and raw digit sequences that satisfy checksum validation.
 */
export function extractIsbnFromText(text: string): string | null {
  if (!text) return null;

  // 1. First priority: Look for explicit 'ISBN' or 'ISBN-10' or 'ISBN-13' prefixes
  // e.g. "ISBN: 978-80-257-0367-0", "ISBN 80-85834-03-5"
  const prefixRegex = /ISBN(?:-?1[03])?[:\s]*([0-9Xx\s\-–—]{9,25})/gi;
  let match: RegExpExecArray | null;

  while ((match = prefixRegex.exec(text)) !== null) {
    const rawCandidate = match[1];
    const cleanCandidate = normalizeIsbn(rawCandidate);
    // Might contain trailing characters or words if matched loosely, slice 13 or 10
    if (cleanCandidate.length >= 13) {
      const sub13 = cleanCandidate.substring(0, 13);
      if (isValidIsbnChecksum(sub13)) return sub13;
    }
    if (cleanCandidate.length >= 10) {
      const sub10 = cleanCandidate.substring(0, 10);
      if (isValidIsbnChecksum(sub10)) return sub10;
    }
  }

  // 2. Second priority: Look for standalone digit groups formatted as 13-digit or 10-digit numbers
  // Matches tokens like 978-80-257-0367-0, 9788025703670, 80-85834-03-5, etc.
  const tokenRegex = /[0-9Xx\s\-–—]{10,25}/g;
  while ((match = tokenRegex.exec(text)) !== null) {
    const cleanCandidate = normalizeIsbn(match[0]);
    if (cleanCandidate.length === 13 && (cleanCandidate.startsWith('978') || cleanCandidate.startsWith('979'))) {
      if (isValidIsbnChecksum(cleanCandidate)) {
        return cleanCandidate;
      }
    }
    if (cleanCandidate.length === 10) {
      if (isValidIsbnChecksum(cleanCandidate)) {
        return cleanCandidate;
      }
    }
  }

  return null;
}

// Singleton worker for Tesseract OCR to avoid re-instantiating heavy WebAssembly worker
let cachedWorker: Worker | null = null;
let workerInitializationPromise: Promise<Worker> | null = null;

export async function getOcrWorker(): Promise<Worker> {
  if (cachedWorker) {
    return cachedWorker;
  }

  if (workerInitializationPromise) {
    return workerInitializationPromise;
  }

  workerInitializationPromise = (async () => {
    const worker = await createWorker('eng');
    // Restrict charset to digits, ISBN prefix, punctuation for maximum speed and accuracy
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789X-ISBNisbn: ./\n',
    });
    cachedWorker = worker;
    return worker;
  })();

  return workerInitializationPromise;
}

/**
 * Terminates the OCR worker to free resources (e.g. on unmount if needed).
 */
export async function terminateOcrWorker(): Promise<void> {
  if (cachedWorker) {
    await cachedWorker.terminate();
    cachedWorker = null;
    workerInitializationPromise = null;
  }
}

/**
 * Captures image from video element to a canvas and enhances contrast.
 */
export function captureAndPreprocessFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }

  const canvas = document.createElement('canvas');
  // Crop center region where user points book text (width 80%, height 40%)
  const cropWidth = Math.round(video.videoWidth * 0.85);
  const cropHeight = Math.round(video.videoHeight * 0.5);
  const startX = Math.round((video.videoWidth - cropWidth) / 2);
  const startY = Math.round((video.videoHeight - cropHeight) / 2);

  canvas.width = cropWidth;
  canvas.height = cropHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  // Grayscale and simple binarization/contrast enhancement for OCR readability
  try {
    const imgData = ctx.getImageData(0, 0, cropWidth, cropHeight);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // standard luminance formula
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // high contrast stretch
      const thresholded = gray > 130 ? 255 : 0;
      data[i] = thresholded;
      data[i + 1] = thresholded;
      data[i + 2] = thresholded;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    // If getImageData fails (e.g. cross-origin), canvas without thresholding will still work
    console.warn('Canvas preprocessing skipped:', err);
  }

  return canvas;
}

/**
 * Recognizes text from image or video element using Tesseract.js and extracts valid ISBN.
 */
export async function recognizeIsbnFromSource(
  source: HTMLVideoElement | HTMLCanvasElement | string
): Promise<string | null> {
  try {
    let targetSource: any = source;
    if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
      const canvas = captureAndPreprocessFrame(source);
      if (!canvas) return null;
      targetSource = canvas;
    }

    const worker = await getOcrWorker();
    const result = await worker.recognize(targetSource);
    const text = result.data?.text || '';
    return extractIsbnFromText(text);
  } catch (err) {
    console.error('Error during OCR recognition:', err);
    return null;
  }
}
