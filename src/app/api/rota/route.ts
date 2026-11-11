import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parseRotaWeek } from "@/lib/server/validation";

/** POST /api/rota saves one week of the staff rota; its id is the Monday of the week. */
export const POST = handle(async (request: Request) => json(await getStore().saveRecord("rotaWeeks", parseRotaWeek(await readJson(request)))));
