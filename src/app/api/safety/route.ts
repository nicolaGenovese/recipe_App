import { requireContext } from "@/lib/server/auth/context";
import { actorOf, safetyEditPermission } from "@/lib/server/guards";
import { handle, json, readJson } from "@/lib/server/http";
import { parseSafetyLog } from "@/lib/server/validation";

/**
 * POST /api/safety saves one food safety record, checked against the site's limits. A correction
 * keeps the previous copy with who changed it and when; older records need "safety.correct".
 */
export const POST = handle(async (request: Request) => {
  const context = await requireContext(request, "safety.record");
  const { settings } = await context.store.getState();
  const log = parseSafetyLog(await readJson(request), settings);
  const before = await context.store.getRecord("safetyLogs", log.id);
  context.require(safetyEditPermission(before?.date ?? null));
  if (before) await context.store.saveVersion("safetyLogs", log.id, before, false, actorOf(context));
  return json(await context.store.saveRecord("safetyLogs", log));
});
