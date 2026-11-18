import { requireContext } from "@/lib/server/auth/context";
import { audit } from "@/lib/server/guards";
import { handle, json, readJson } from "@/lib/server/http";
import { parseRotaWeek } from "@/lib/server/validation";

/** POST /api/rota saves one week of the staff rota of the chosen site; its id is the Monday of the week. */
export const POST = handle(async (request: Request) => {
  const context = await requireContext(request, "rota.edit");
  const week = parseRotaWeek(await readJson(request));
  const saved = await context.store.saveRecord("rotaWeeks", week);
  await audit(context, "rota", week.id, { people: week.rows.filter((row) => row.shifts.some(Boolean)).length });
  return json(saved);
});
