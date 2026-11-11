import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parseSalesWeek } from "@/lib/server/validation";

/** POST /api/sales saves the dishes sold in one week (id = Monday). */
export const POST = handle(async (request: Request) => json(await getStore().saveRecord("salesWeeks", parseSalesWeek(await readJson(request)))));
