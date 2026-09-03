/**
 * Client-side image preparation.
 *
 * Meta's ad image endpoint REJECTS WebP, so anything WebP is converted to JPEG
 * before it reaches storage (docs/SPEC.md §9 rule 13). This ran in the Lovable
 * build and must not be dropped — without it uploads succeed and the push
 * later fails with an opaque Meta error.
 */

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 20 * 1024 * 1024;

/** Quality 0.95, matching the original — high enough that ad creative survives it. */
const JPEG_QUALITY = 0.95;

export interface PreparedImage {
  blob: Blob;
  extension: "jpg" | "png";
  contentType: string;
  width: number;
  height: number;
}

export function isAccepted(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} could not be read as an image.`));
    };
    img.src = url;
  });
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isAccepted(file)) {
    throw new Error(`${file.name} is not a JPEG, PNG or WebP.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} is larger than 20 MB.`);
  }

  const img = await loadImage(file);

  // Only WebP needs converting. Re-encoding a JPEG or PNG would lose quality
  // for no reason.
  if (file.type !== "image/webp") {
    return {
      blob: file,
      extension: file.type === "image/png" ? "png" : "jpg",
      contentType: file.type,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not convert WebP — canvas is unavailable.");

  // WebP supports transparency; JPEG does not. Without this, transparent
  // regions render black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error(`Could not convert ${file.name} from WebP.`);

  return {
    blob,
    extension: "jpg",
    contentType: "image/jpeg",
    width: canvas.width,
    height: canvas.height,
  };
}

/** Storage path: {clientId}/{timestamp}_{random}.{ext} */
export function storagePath(clientId: string, extension: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${clientId}/${Date.now()}_${random}.${extension}`;
}
