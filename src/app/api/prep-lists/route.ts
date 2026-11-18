import { requireContext } from "@/lib/server/auth/context";
import { onlyTicksChanged } from "@/lib/server/guards";
import { handle, json, readJson } from "@/lib/server/http";
import { parsePrepList } from "@/lib/server/validation";

/** POST /api/prep-lists creates or updates one prep list; ticking jobs off needs only "prep.tick". */
export const POST = handle(async (request: Request) => {
  const context = await requireContext(request);
  const list = parsePrepList(await readJson(request));
  if (!context.can("prep.edit")) {
    context.require("prep.tick");
    if (!onlyTicksChanged(await context.store.getRecord("prepLists", list.id), list)) context.require("prep.edit");
  }
  return json(await context.store.saveRecord("prepLists", list));
});
