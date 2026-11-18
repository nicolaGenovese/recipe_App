import { requireContext } from "@/lib/server/auth/context";
import { actorOf } from "@/lib/server/guards";
import { handle, json } from "@/lib/server/http";
import { assertId } from "@/lib/server/validation";

/** Deleting a food safety record removes it from the register, but a copy is kept with who deleted it. */
export const DELETE = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireContext(request, "safety.correct");
  const id = assertId(decodeURIComponent((await params).id));
  const before = await context.store.getRecord("safetyLogs", id);
  if (before) await context.store.saveVersion("safetyLogs", id, before, true, actorOf(context));
  await context.store.deleteRecord("safetyLogs", id);
  return json({ ok: true });
});
