import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { LEGACY_MENU_ID, legacyMenus } from "@/lib/menus/menus";
import { clone } from "@/lib/num";
import { DEMO_RECIPES, DEMO_STOCK_ITEMS } from "@/lib/seed";
import { normalizeSettings } from "@/lib/settings";
import type { AppData } from "@/lib/types";
import type { RecordKind, Store } from "@/lib/server/store/types";

const LIST_KEYS = {
  items: "stockItems", reports: "stockReports", deliveries: "stockDeliveries", menus: "menus", prepLists: "prepLists", rotaWeeks: "rotaWeeks", safetyLogs: "safetyLogs", wasteLogs: "wasteLogs", salesWeeks: "salesWeeks"
} as const satisfies Record<RecordKind, keyof AppData>;

export function localDataFile(): string {
  return process.env.DATA_FILE?.trim() || path.join(process.cwd(), "data", "recipes.json");
}

/** The fixed id means the menu is the same on every read until the first save writes it to the file. */
export function firstMenus(recipes: AppData["recipes"], language?: string) {
  return legacyMenus(recipes, language === "en" ? "Main menu" : "Menu principale", LEGACY_MENU_ID);
}

function emptyData(): AppData {
  return { recipes: clone(DEMO_RECIPES), settings: normalizeSettings(null), stockItems: clone(DEMO_STOCK_ITEMS), stockReports: [], stockDeliveries: [], menus: firstMenus(DEMO_RECIPES), prepLists: [], rotaWeeks: [], safetyLogs: [], wasteLogs: [], salesWeeks: [] };
}

async function readData(file: string): Promise<AppData> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<AppData>;
    const recipes = Array.isArray(parsed.recipes) ? parsed.recipes : clone(DEMO_RECIPES);
    return {
      recipes,
      settings: normalizeSettings(parsed.settings, Array.isArray(parsed.rotaWeeks) ? parsed.rotaWeeks : []),
      stockItems: Array.isArray(parsed.stockItems) ? parsed.stockItems : clone(DEMO_STOCK_ITEMS),
      stockReports: Array.isArray(parsed.stockReports) ? parsed.stockReports : [],
      stockDeliveries: Array.isArray(parsed.stockDeliveries) ? parsed.stockDeliveries : [],
      // Archives from before menus existed get their first menu from the old "current menu" flag.
      menus: Array.isArray(parsed.menus) ? parsed.menus : firstMenus(recipes, parsed.settings?.language),
      prepLists: Array.isArray(parsed.prepLists) ? parsed.prepLists : [],
      rotaWeeks: Array.isArray(parsed.rotaWeeks) ? parsed.rotaWeeks : [],
      safetyLogs: Array.isArray(parsed.safetyLogs) ? parsed.safetyLogs : [],
      wasteLogs: Array.isArray(parsed.wasteLogs) ? parsed.wasteLogs : [],
      salesWeeks: Array.isArray(parsed.salesWeeks) ? parsed.salesWeeks : []
    };
  } catch {
    return emptyData();
  }
}

/** Writes go through a temporary file and a rename, so a crash never leaves half a file. */
async function writeData(file: string, data: AppData): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + ".tmp";
  await writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
  await rename(temporary, file);
}

function upsertById<T extends { id: string }>(list: T[], saved: T): void {
  const index = list.findIndex((item) => item.id === saved.id);
  if (index >= 0) list[index] = saved;
  else list.unshift(saved);
}

export function createLocalStore(file = localDataFile()): Store {
  // Changes run one after another, so two quick saves cannot overwrite each other.
  let queue: Promise<unknown> = Promise.resolve();
  const change = <T>(apply: (data: AppData) => T): Promise<T> => {
    const run = queue.then(async () => {
      const data = await readData(file);
      const result = apply(data);
      await writeData(file, data);
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    mode: "local",
    async health() { return { connected: true, error: null }; },
    async getState() { return { ...(await readData(file)), storage: "local" }; },
    saveRecipe: (recipe) => change((data) => { upsertById(data.recipes, recipe); return recipe; }),
    deleteRecipe: (id) => change((data) => { data.recipes = data.recipes.filter((recipe) => recipe.id !== id); }),
    saveSettings: (settings) => change((data) => { data.settings = settings; return settings; }),
    saveRecord: (kind, record) => change((data) => { upsertById(data[LIST_KEYS[kind]] as { id: string }[], record); return record; }),
    deleteRecord: (kind, id) => change((data) => {
      const key = LIST_KEYS[kind];
      (data[key] as { id: string }[]) = (data[key] as { id: string }[]).filter((row) => row.id !== id);
    })
  };
}
