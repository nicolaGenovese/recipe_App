import { NextResponse } from "next/server";
import { requireContext } from "@/lib/server/auth/context";
import { handle, json } from "@/lib/server/http";
import { HttpError, assertId } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET /api/photos/:id returns the image, only to people of the same company. Ids are never reused. */
export const GET = handle(async (request: Request, context: Context) => {
  const { store } = await requireContext(request);
  const photo = await store.getPhoto(assertId(decodeURIComponent((await context.params).id)));
  if (!photo) throw new HttpError(404, "Foto non trovata.");
  return new NextResponse(new Uint8Array(Buffer.from(photo.data, "base64")), {
    headers: { "content-type": photo.mimeType, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" }
  });
});

/** DELETE /api/photos/:id removes a photo that a record no longer uses. */
export const DELETE = handle(async (request: Request, context: Context) => {
  const { store } = await requireContext(request, "safety.record");
  await store.deletePhoto(assertId(decodeURIComponent((await context.params).id)));
  return json({ ok: true });
});
