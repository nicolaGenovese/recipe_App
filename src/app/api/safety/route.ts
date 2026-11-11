import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parseSafetyLog } from "@/lib/server/validation";

/** POST /api/safety saves one food safety record, checked against the kitchen's limits. */
export const POST = handle(async (request: Request) => {
  const store = getStore();
  const { settings } = await store.getState();
  return json(await store.saveRecord("safetyLogs", parseSafetyLog(await readJson(request), settings)));
});
