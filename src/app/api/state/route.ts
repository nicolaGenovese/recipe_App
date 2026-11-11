import { getStore } from "@/lib/server/store";
import { handle, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The whole archive in one response: recipes, settings and the three stock lists. */
export const GET = handle(async () => json(await getStore().getState()));
