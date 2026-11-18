import { requireContext } from "@/lib/server/auth/context";
import { handle, json, readJson } from "@/lib/server/http";
import { parseSalesWeek } from "@/lib/server/validation";

/** POST /api/sales saves the dishes sold in one week (id = Monday) at the chosen site. */
export const POST = handle(async (request: Request) => {
  const { store } = await requireContext(request, "sales.view");
  return json(await store.saveRecord("salesWeeks", parseSalesWeek(await readJson(request))));
});
