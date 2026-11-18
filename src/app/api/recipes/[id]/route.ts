import { requireContext } from "@/lib/server/auth/context";
import { recipePermission } from "@/lib/server/guards";
import { handle, json } from "@/lib/server/http";
import { assertId } from "@/lib/server/validation";

export const DELETE = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireContext(request);
  const id = assertId(decodeURIComponent((await params).id));
  const site = await context.store.recipeSite(id);
  if (site === undefined) return json({ ok: true });
  context.require(recipePermission(site, Boolean(site), context.scope.siteId));
  await context.store.deleteRecipe(id);
  return json({ ok: true });
});
