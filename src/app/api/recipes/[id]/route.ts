import { getStore } from "@/lib/server/store";
import { handle, json } from "@/lib/server/http";
import { assertId } from "@/lib/server/validation";

export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await getStore().deleteRecipe(assertId(decodeURIComponent((await params).id)));
  return json({ ok: true });
});
