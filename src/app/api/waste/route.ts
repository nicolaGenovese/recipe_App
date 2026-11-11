import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parseWasteLog } from "@/lib/server/validation";

/** POST /api/waste saves one waste record. */
export const POST = handle(async (request: Request) => json(await getStore().saveRecord("wasteLogs", parseWasteLog(await readJson(request)))));
