import { requireContext } from "@/lib/server/auth/context";
import { handle, json, readJson } from "@/lib/server/http";
import { parsePhoto } from "@/lib/server/validation";

/** POST /api/photos stores one photo (a temperature reading); records point to it by id. */
export const POST = handle(async (request: Request) => {
  const { store } = await requireContext(request, "safety.record");
  const { id, mimeType, data } = parsePhoto(await readJson(request));
  await store.savePhoto(id, { mimeType, data });
  return json({ id });
});
