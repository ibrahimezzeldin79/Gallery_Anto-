import { idbSet } from "./idbStorage";

/**
 * Utility to compress image data URLs or Files using HTML5 Canvas.
 * Reduces raw 2MB - 5MB base64 images down to ~10KB - 20KB JPEG strings
 * preventing storage errors and browser crashes.
 */

export function compressImageDataUrl(
  dataUrl: string,
  maxWidth = 280,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      resolve(dataUrl || "");
      return;
    }

    // If already small (< 15KB base64), return as is
    if (dataUrl.length < 15000) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      // Fill white background for transparent PNG conversion to JPEG
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(img, 0, 0, width, height);
      
      try {
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Safe storage setter wrapper to save to IndexedDB and fallback safely to localStorage
 */
export function safeSetLocalStorage(key: string, data: any): boolean {
  // Delegate to high-capacity IndexedDB + localStorage sync engine
  idbSet(key, data).catch((err) => {
    console.error("[Storage Engine] Failed to sync data:", err);
  });
  return true;
}

