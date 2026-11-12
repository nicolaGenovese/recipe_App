import { RecipeStudio } from "@/components/shell/RecipeStudio";
import { accessRequired } from "@/lib/server/access";
import { getStore } from "@/lib/server/store";
import type { AppState } from "@/lib/types";
import { AppProvider } from "@/state/AppProvider";

// The archive changes all the time, so the page is never cached.
export const dynamic = "force-dynamic";

/** Loads the archive on the server, so the first paint already shows real data. */
export default async function Home() {
  let initialState: AppState | null = null;
  try { initialState = await getStore().getState(); }
  catch (error) { console.error("Archivio non raggiungibile:", error instanceof Error ? error.message : error); }
  return (
    <AppProvider initialState={initialState} accessProtected={accessRequired()}>
      <RecipeStudio />
    </AppProvider>
  );
}
