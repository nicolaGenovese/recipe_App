import { requireContext } from "@/lib/server/auth/context";
import { handle, json, readJson } from "@/lib/server/http";
import { parseMenu } from "@/lib/server/validation";

/** POST /api/menus creates or updates one menu of the chosen site. */
export const POST = handle(async (request: Request) => {
  const { store } = await requireContext(request, "menus.edit");
  return json(await store.saveRecord("menus", parseMenu(await readJson(request))));
});
