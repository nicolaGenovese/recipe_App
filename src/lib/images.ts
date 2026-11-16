/** Browser-side image helpers shared by invoice scans and temperature photos. */

export const readAsBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** Resizes a photo so its longest side is at most `maxSide` and re-encodes it as JPEG. */
export async function shrinkImage(file: Blob, maxSide: number, quality: number): Promise<{ mimeType: "image/jpeg"; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("photo");
  return { mimeType: "image/jpeg", data: await readAsBase64(blob) };
}

/** Where the app serves a stored photo. */
export const photoUrl = (id: string) => "/api/photos/" + encodeURIComponent(id);
