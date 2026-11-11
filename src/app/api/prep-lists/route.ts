import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parsePrepList } from "@/lib/server/validation";

/** POST /api/prep-lists creates or updates one prep list. */
export const POST = handle(async (request: Request) => json(await getStore().saveRecord("prepLists", parsePrepList(await readJson(request)))));
