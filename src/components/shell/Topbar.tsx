"use client";

import { StockAlerts } from "@/components/shell/StockAlerts";
import { BrandIcon, DownloadIcon, PlateIcon, SearchIcon } from "@/components/ui/icons";
import { KITCHEN_KEY } from "@/lib/kitchen/today";
import { useApp } from "@/state/AppProvider";
import { useArchiveActions } from "@/state/actions/useArchiveActions";
import type { ViewFilter } from "@/state/view";

const CRUMBS: Record<ViewFilter, string> = { all: "Ricette", menu: "In menu", archive: "Ricette base", stock: "Food Stock", menus: "Menu", prep: "Prep list", rota: "Turni", safety: "Sicurezza alimentare", performance: "Andamento", kitchen: "Modalità cucina" };

export function Topbar() {
  const { data, view, setView, t } = useApp();
  const menu = view.filter === "menu" && view.menuId ? data.menus.find((row) => row.id === view.menuId) : undefined;
  const { exportJson } = useArchiveActions();
  const recipePage = view.filter === "all" || view.filter === "menu" || view.filter === "archive";
  // Remembered on this device: it reopens in kitchen mode until someone leaves it there.
  const enterKitchen = () => {
    try { window.localStorage.setItem(KITCHEN_KEY, "1"); } catch { /* Kitchen mode then lasts until the page is reloaded. */ }
    setView({ filter: "kitchen" });
  };

  return (
    <header className="topbar">
      <a className="topbar-brand" href="#" aria-label={t("Recipe Studio, ricette")} onClick={(event) => { event.preventDefault(); setView({ filter: "all", menuId: null, page: 1 }); }}>
        <span className="brand-mark" aria-hidden="true"><BrandIcon /></span>
      </a>
      <div className="breadcrumbs"><span>{t("La mia cucina")}</span><span className="crumb-slash">/</span><strong>{menu ? menu.name : t(CRUMBS[view.filter])}</strong></div>
      <div className="topbar-actions">
        {/* The box searches recipes, so it shows on the recipe pages; elsewhere a button says where it goes. */}
        {recipePage ? (
          <label className="global-search" htmlFor="searchInput">
            <SearchIcon />
            <input id="searchInput" type="search" placeholder={t("Cerca ricette, ingredienti…")} autoComplete="off" value={view.query}
              onChange={(event) => setView({ query: event.target.value, page: 1 })} />
            <kbd>⌘ K</kbd>
          </label>
        ) : (
          <button className="button button-quiet topbar-search-jump" type="button" onClick={() => { setView({ filter: "all", menuId: null, page: 1 }); window.setTimeout(() => document.getElementById("searchInput")?.focus(), 50); }}>
            <SearchIcon /><span>{t("Cerca ricette")}</span>
          </button>
        )}
        <StockAlerts />
        <button className="topbar-icon" type="button" onClick={exportJson} aria-label={t("Esporta archivio")} title={t("Esporta archivio (copia di sicurezza in JSON)")}><DownloadIcon /></button>
        <button className="button button-primary topbar-kitchen" type="button" onClick={enterKitchen} aria-label={t("Modalità cucina")} title={t("Prep list, temperature e checklist con pulsanti grandi")}>
          <PlateIcon /><span>{t("Modalità cucina")}</span>
        </button>
      </div>
    </header>
  );
}
