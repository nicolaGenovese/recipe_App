import { redactState } from "@/lib/access/redact";
import { resolveContext } from "@/lib/server/auth/context";
import { handle, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The archive of the chosen site, with what the user may not see removed. */
export const GET = handle(async (request: Request) => {
  const { store, access } = await resolveContext(request.headers);
  return json(redactState({ ...(await store.getState()), access }, access));
});
