"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { currencyCode, makeFormatters, type Formatters } from "@/lib/format";
import { fmt, localeFor, makeTranslate, readStoredLanguage, storeLanguage, type Translate } from "@/lib/i18n";
import { menuRecipeIds } from "@/lib/menus/menus";
import { normalizeSettings } from "@/lib/settings";
import { clone } from "@/lib/num";
import { canDo, type AccessInfo, type Permission } from "@/lib/access/permissions";
import type { AppData, AppState, GpRules, Health, Language, SharedShift } from "@/lib/types";
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
  /** Set when the archive could not be read at all: the app shows why and a way to try again, not an empty kitchen. */
  loadError: string | null;
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
  dismissToast: () => void;
  /** True when the app sits behind accounts or the shared password, so a "log out" button makes sense. */
  accessProtected: boolean;
  /** Signed-in user, company, site and permissions; null in local mode, where everything is allowed. */
  access: AccessInfo | null;
  can: (permission: Permission) => boolean;
  /** Shifts the people of this site have at other sites of the company. */
  sharedShifts: SharedShift[];
  /** Opens another site of the user's companies and reloads its data. */
  switchSite: (siteId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SITE_COOKIE = "rs_site";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const everLoaded = useRef(Boolean(initialState));
  const [health, setHealth] = useState<Health | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(initialState?.access ?? null);
  const [sharedShifts, setSharedShifts] = useState<SharedShift[]>(initialState?.sharedShifts ?? []);
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
    // Errors stay until they are closed, so there is time to read what went wrong and act on it.
    // Other messages stay longer when they are longer.
    if (!error) toastTimer.current = setTimeout(() => setToast(null), Math.min(9000, Math.max(3500, message.length * 60)));
  }, []);
  const dismissToast = useCallback(() => { clearTimeout(toastTimer.current); setToast(null); }, []);

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
      setAccess(state.access ?? null);
      setSharedShifts(state.sharedShifts ?? []);
      if (state.settings?.language) setLanguage(state.settings.language);
      everLoaded.current = true;
      setLoadError(null);
    } catch (error) {
      const message = t(error instanceof Error ? error.message : String(error));
      // Never loaded: a screen that says so. Already loaded: the data on screen stays, with a message.
      if (!everLoaded.current) setLoadError(message);
      else notify(message.startsWith(t("Archivio non raggiungibile:").replace(/:$/, "")) ? message : t("Archivio non raggiungibile:") + " " + message, true);
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
    data, current, update, reload, loaded, loadError, health, refreshHealth, language, setLanguage, t, f, fmt,
    gpRules: data.settings.gp, onMenu,
    view, setView: useCallback((change) => setViewState((old) => ({ ...old, ...change })), []),
    stockView,
    setStockView: useCallback((change) => setStockViewState((old) => ({ ...old, ...(typeof change === "function" ? change(old) : change) })), []),
    dialog, openDialog: setDialog, closeDialog: useCallback(() => setDialog(null), []),
    toast, notify, dismissToast, accessProtected,
    access, sharedShifts,
    can: useCallback((permission: Permission) => canDo(access, permission), [access]),
    switchSite: useCallback(async (siteId: string) => {
      // A preference only: the server checks it against the user's assignments on every request.
      document.cookie = SITE_COOKIE + "=" + encodeURIComponent(siteId) + "; path=/; max-age=31536000; samesite=lax";
      setViewState((old) => ({ ...old, filter: old.filter === "kitchen" ? "kitchen" : "all", menuId: null, page: 1 }));
      await reload();
      await refreshHealth();
    }, [reload, refreshHealth]),
    logout: useCallback(async () => {
      await fetch(access ? "/api/auth/sign-out" : "/api/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => undefined);
      window.location.assign("/login");
    }, [access])
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
