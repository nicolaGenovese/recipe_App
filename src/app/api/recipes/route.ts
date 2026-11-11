import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { parseRecipe } from "@/lib/server/validation";

/** Creates or updates a recipe; the server stamps updatedAt. */
export const POST = handle(async (request: Request) => json(await getStore().saveRecipe(parseRecipe(await readJson(request)))));
