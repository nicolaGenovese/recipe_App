import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parseMenu } from "@/lib/server/validation";

/** POST /api/menus creates or updates one menu. */
export const POST = handle(async (request: Request) => json(await getStore().saveRecord("menus", parseMenu(await readJson(request)))));
