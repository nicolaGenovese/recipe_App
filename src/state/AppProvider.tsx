"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { currencyCode, makeFormatters, type Formatters } from "@/lib/format";
import { fmt, localeFor, makeTranslate, readStoredLanguage, storeLanguage, type Translate } from "@/lib/i18n";
import { menuRecipeIds } from "@/lib/menus/menus";
import { normalizeSettings } from "@/lib/settings";
import { clone } from "@/lib/num";
import type { AppData, AppState, GpRules, Health, Language } from "@/lib/types";
import { api } from "@/state/api";
import type { DialogState } from "@/state/dialogs";
import { INITIAL_STOCK_VIEW, INITIAL_VIEW, type StockViewState, type ViewState } from "@/state/view";

interface Toast { message: string; error: boolean; id: number }

interface AppContextValue {
  data: AppData;
  /** The latest data, also inside async actions that started before the last render. */
  current: () => AppData;
  update: (change: (data: AppData) => AppData) => void;
  reload: () => Promise<void>;
  loaded: boolean;
  health: Health | null;
  refreshHealth: () => Promise<void>;
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
  f: Formatters;
  fmt: typeof fmt;
  gpRules: GpRules;
  /** Ids of the dishes on at least one active menu. */
  onMenu: Set<string>;
  view: ViewState;
  setView: (change: Partial<ViewState>) => void;
  stockView: StockViewState;
  setStockView: (change: Partial<StockViewState> | ((view: StockViewState) => Partial<StockViewState>)) => void;
  dialog: DialogState | null;
  openDialog: (dialog: DialogState) => void;
  closeDialog: () => void;
  toast: Toast | null;
  notify: (message: string, error?: boolean) => void;
  /** True when the app sits behind the shared password, so a "log out" button makes sense. */
  accessProtected: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function fallbackData(): AppData {
  return { recipes: [], settings: normalizeSettings(null), stockItems: [], stockReports: [], stockDeliveries: [], menus: [], prepLists: [], rotaWeeks: [], safetyLogs: [], wasteLogs: [], salesWeeks: [] };
}

function toData(state: AppState): AppData {
  return {
    recipes: Array.isArray(state.recipes) ? state.recipes : [],
    settings: normalizeSettings(state.settings),
    stockItems: Array.isArray(state.stockItems) ? state.stockItems : [],
    stockReports: Array.isArray(state.stockReports) ? state.stockReports : [],
    stockDeliveries: Array.isArray(state.stockDeliveries) ? state.stockDeliveries : [],
    menus: Array.isArray(state.menus) ? state.menus : [],
    prepLists: Array.isArray(state.prepLists) ? state.prepLists : [],
    rotaWeeks: Array.isArray(state.rotaWeeks) ? state.rotaWeeks : [],
    safetyLogs: Array.isArray(state.safetyLogs) ? state.safetyLogs : [],
    wasteLogs: Array.isArray(state.wasteLogs) ? state.wasteLogs : [],
    salesWeeks: Array.isArray(state.salesWeeks) ? state.salesWeeks : []
  };
}

export function AppProvider({ initialState, accessProtected = false, children }: { initialState: AppState | null; accessProtected?: boolean; children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => (initialState ? toData(initialState) : fallbackData()));
  const dataRef = useRef(data);
  const [loaded, setLoaded] = useState(Boolean(initialState));
  const [health, setHealth] = useState<Health | null>(null);
  const [language, setLanguageState] = useState<Language>(initialState?.settings?.language ?? "en");
  const [view, setViewState] = useState(INITIAL_VIEW);
  const [stockView, setStockViewState] = useState(INITIAL_STOCK_VIEW);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const t = useMemo(() => makeTranslate(language), [language]);
  const f = useMemo(() => makeFormatters(localeFor(language), currencyCode(data.settings.currency)), [language, data.settings.currency]);

  const onMenu = useMemo(() => menuRecipeIds(data.menus), [data.menus]);

  const update = useCallback((change: (data: AppData) => AppData) => {
    dataRef.current = change(dataRef.current);
    setData(dataRef.current);
  }, []);
  const current = useCallback(() => dataRef.current, []);

  const notify = useCallback((message: string, error = false) => {
    clearTimeout(toastTimer.current);
    setToast({ message, error, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    storeLanguage(next);
  }, []);

  const refreshHealth = useCallback(async () => {
    try { setHealth(await api.health()); } catch { /* The status badge simply stays as it was. */ }
  }, []);

  const reload = useCallback(async () => {
    try {
      const state = await api.state();
      update(() => toData(state));
      if (state.settings?.language) setLanguage(state.settings.language);
    } catch (error) {
      notify(t("Archivio non raggiungibile:") + " " + t(error instanceof Error ? error.message : String(error)), true);
    }
    setLoaded(true);
  }, [notify, setLanguage, t, update]);

  // The archive language wins; without one, this browser's last choice is used.
  useEffect(() => {
    setLanguageState(initialState?.settings?.language ?? readStoredLanguage());
    if (!initialState) void reload();
    void refreshHealth();
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { document.documentElement.lang = language; document.title = t("Ricette · Recipe Studio"); }, [language, t]);

  const value: AppContextValue = {
    data, current, update, reload, loaded, health, refreshHealth, language, setLanguage, t, f, fmt,
    gpRules: data.settings.gp, onMenu,
    view, setView: useCallback((change) => setViewState((old) => ({ ...old, ...change })), []),
    stockView,
    setStockView: useCallback((change) => setStockViewState((old) => ({ ...old, ...(typeof change === "function" ? change(old) : change) })), []),
    dialog, openDialog: setDialog, closeDialog: useCallback(() => setDialog(null), []),
    toast, notify, accessProtected
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
