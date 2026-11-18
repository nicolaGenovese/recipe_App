import { requireContext } from "@/lib/server/auth/context";
import { handle, json } from "@/lib/server/http";
import { assertId, HttpError, isStockKind } from "@/lib/server/validation";

export const DELETE = handle(async (request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) => {
  const { kind, id } = await params;
  if (!isStockKind(kind)) throw new HttpError(404, "Risorsa non trovata.");
  const context = await requireContext(request, kind === "deliveries" ? "stock.deliveries" : "stock.manage");
  await context.store.deleteRecord(kind, assertId(decodeURIComponent(id)));
  return json({ ok: true });
});
