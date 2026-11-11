import { getStore } from "@/lib/server/store";
import { handle, json } from "@/lib/server/http";
import { assertId } from "@/lib/server/validation";

export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await getStore().deleteRecord("prepLists", assertId(decodeURIComponent(id)));
  return json({ ok: true });
});
