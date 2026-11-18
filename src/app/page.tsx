import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RecipeStudio } from "@/components/shell/RecipeStudio";
import { redactState } from "@/lib/access/redact";
import { accessRequired } from "@/lib/server/access";
import { resolveContext } from "@/lib/server/auth/context";
import { database } from "@/lib/server/db";
import { HttpError } from "@/lib/server/validation";
import type { AppState } from "@/lib/types";
import { AppProvider } from "@/state/AppProvider";

// The archive changes all the time, so the page is never cached.
export const dynamic = "force-dynamic";

/**
 * Loads the archive of the chosen site on the server, so the first paint already shows real data.
 * Without a session it sends to the login page, and an account with no company to the welcome page.
 */
export default async function Home() {
  let initialState: AppState | null = null;
  let goTo: string | null = null;
  try {
    const { store, access } = await resolveContext(await headers());
    initialState = redactState({ ...(await store.getState()), access }, access);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) goTo = "/login";
    else if (error instanceof HttpError && error.detail === "no-company") goTo = "/benvenuto";
    else console.error("Archivio non raggiungibile:", error instanceof Error ? error.message : error);
  }
  // redirect() works by throwing, so it stays outside the try.
  if (goTo) redirect(goTo);
  return (
    <AppProvider initialState={initialState} accessProtected={Boolean(database()) || accessRequired()}>
      <RecipeStudio />
    </AppProvider>
  );
}
