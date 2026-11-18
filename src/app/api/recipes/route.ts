import { requireContext } from "@/lib/server/auth/context";
import { recipePermission } from "@/lib/server/guards";
import { handle, json, readJson } from "@/lib/server/http";
import { parseRecipe } from "@/lib/server/validation";

/** Creates or updates a recipe of the company library, or of the chosen site when siteId is set. */
export const POST = handle(async (request: Request) => {
  const context = await requireContext(request);
  const recipe = parseRecipe(await readJson(request));
  context.require(recipePermission(await context.store.recipeSite(recipe.id), Boolean(recipe.siteId), context.scope.siteId));
  return json(await context.store.saveRecipe(recipe));
});
