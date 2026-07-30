import type { HomeBackgroundV1 } from "../core/types";

export const MAX_BACKGROUND_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_BACKGROUND_DATA_BYTES = 4 * 1024 * 1024;
export const MAX_BACKGROUND_EDGE = 2_560;

export function isSupportedBackgroundFile(file: {
  type: string;
  size: number;
}): boolean {
  return (
    file.type.startsWith("image/") &&
    file.type !== "image/svg+xml" &&
    file.size > 0 &&
    file.size <= MAX_BACKGROUND_FILE_BYTES
  );
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Image conversion returned no data"));
      }
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Image conversion failed")),
    );
    reader.readAsDataURL(blob);
  });
}

export async function prepareBackground(file: File): Promise<HomeBackgroundV1> {
  if (!isSupportedBackgroundFile(file)) {
    throw new Error("Unsupported background image");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_BACKGROUND_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Canvas is unavailable");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.86, 0.72, 0.58, 0.44]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob && blob.size <= MAX_BACKGROUND_DATA_BYTES) {
        return {
          version: 1,
          dataUrl: await blobDataUrl(blob),
          updatedAt: Date.now(),
        };
      }
    }
    throw new Error("Background image remains too large");
  } finally {
    bitmap.close();
  }
}
