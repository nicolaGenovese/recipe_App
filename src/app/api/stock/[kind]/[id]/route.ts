import { getStore } from "@/lib/server/store";
import { handle, json } from "@/lib/server/http";
import { assertId, HttpError, isStockKind } from "@/lib/server/validation";

export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) => {
  const { kind, id } = await params;
  if (!isStockKind(kind)) throw new HttpError(404, "Risorsa non trovata.");
  await getStore().deleteRecord(kind, assertId(decodeURIComponent(id)));
  return json({ ok: true });
});
