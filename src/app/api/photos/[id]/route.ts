import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { handle, json } from "@/lib/server/http";
import { HttpError, assertId } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET /api/photos/:id returns the image. Ids are never reused, so the browser may keep it. */
export const GET = handle(async (_request: Request, context: Context) => {
  const id = assertId(decodeURIComponent((await context.params).id));
  const photo = await getStore().getPhoto(id);
  if (!photo) throw new HttpError(404, "Foto non trovata.");
  return new NextResponse(new Uint8Array(Buffer.from(photo.data, "base64")), {
    headers: { "content-type": photo.mimeType, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" }
  });
});

/** DELETE /api/photos/:id removes a photo that a record no longer uses. */
export const DELETE = handle(async (_request: Request, context: Context) => {
  await getStore().deletePhoto(assertId(decodeURIComponent((await context.params).id)));
  return json({ ok: true });
});
