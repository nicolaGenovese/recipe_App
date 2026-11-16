import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parsePhoto } from "@/lib/server/validation";

/** POST /api/photos stores one photo (a temperature reading); records point to it by id. */
export const POST = handle(async (request: Request) => {
  const { id, mimeType, data } = parsePhoto(await readJson(request));
  await getStore().savePhoto(id, { mimeType, data });
  return json({ id });
});
