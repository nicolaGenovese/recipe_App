import { requireContext } from "@/lib/server/auth/context";
import { handle, json, readJson } from "@/lib/server/http";
import { wasteUnitCost } from "@/lib/performance/waste";
import { parseWasteLog } from "@/lib/server/validation";

/** POST /api/waste saves one waste record. Without "costs.view" the cost is worked out here, from the real prices. */
export const POST = handle(async (request: Request) => {
  const context = await requireContext(request, "waste.record");
  const log = parseWasteLog(await readJson(request));
  if (!context.can("costs.view")) {
    const [state, before] = await Promise.all([context.store.getState(), context.store.getRecord("wasteLogs", log.id)]);
    log.unitCost = wasteUnitCost(log.source, log.itemId, log.unit, state.recipes, state.stockItems) ?? before?.unitCost ?? 0;
  }
  return json(await context.store.saveRecord("wasteLogs", log));
});
