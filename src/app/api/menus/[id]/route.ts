import { requireContext } from "@/lib/server/auth/context";
import { handle, json } from "@/lib/server/http";
import { assertId } from "@/lib/server/validation";

export const DELETE = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { store } = await requireContext(request, "menus.edit");
  await store.deleteRecord("menus", assertId(decodeURIComponent((await params).id)));
  return json({ ok: true });
});
