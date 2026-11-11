import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parseSettings } from "@/lib/server/validation";

export const PUT = handle(async (request: Request) => json(await getStore().saveSettings(parseSettings(await readJson(request)))));
