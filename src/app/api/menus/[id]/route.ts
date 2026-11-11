import { getStore } from "@/lib/server/store";
import { handle, json } from "@/lib/server/http";
import { assertId } from "@/lib/server/validation";

/** DELETE /api/menus/:id removes the menu. Its dishes stay in the recipe archive. */
export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await getStore().deleteRecord("menus", assertId(decodeURIComponent(id)));
  return json({ ok: true });
});
