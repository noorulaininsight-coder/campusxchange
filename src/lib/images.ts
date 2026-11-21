import { supabase, userError } from "./supabase";
export async function compressImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw userError("Choose JPEG, PNG or WebP images.");
  if (file.size > 12 * 1024 * 1024)
    throw userError("Original images must be smaller than 12 MB.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw userError("Image processing is unavailable in this browser.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.84, 0.72, 0.6, 0.45, 0.3]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (blob && blob.type === "image/webp" && blob.size <= 350 * 1024)
      return blob;
  }
  throw userError("This image is too detailed. Choose a smaller image.");
}
export async function signedImage(path: string, bucket = "listing-images") {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
