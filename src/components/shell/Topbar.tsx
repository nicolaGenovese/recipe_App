"use client";

import { StockAlerts } from "@/components/shell/StockAlerts";
import { BrandIcon, DownloadIcon, SearchIcon } from "@/components/ui/icons";
import { useApp } from "@/state/AppProvider";
import { useArchiveActions } from "@/state/actions/useArchiveActions";
import type { ViewFilter } from "@/state/view";

const CRUMBS: Record<ViewFilter, string> = { all: "Ricette", menu: "In menu", archive: "Basi e archivio", stock: "Food Stock", menus: "Menu", prep: "Prep list", rota: "Turni", safety: "Sicurezza alimentare", performance: "Andamento", kitchen: "Modalità cucina" };

export function Topbar() {
  const { data, view, setView, t } = useApp();
  const menu = view.filter === "menu" && view.menuId ? data.menus.find((row) => row.id === view.menuId) : undefined;
  const { exportJson } = useArchiveActions();

  return (
    <header className="topbar">
      <a className="topbar-brand" href="#" aria-label={t("Recipe Studio, ricette")} onClick={(event) => { event.preventDefault(); setView({ filter: "all", menuId: null, page: 1 }); }}>
        <span className="brand-mark" aria-hidden="true"><BrandIcon /></span>
      </a>
      <div className="breadcrumbs"><span>{t("La mia cucina")}</span><span className="crumb-slash">/</span><strong>{menu ? menu.name : t(CRUMBS[view.filter])}</strong></div>
      <div className="topbar-actions">
        <label className="global-search" htmlFor="searchInput">
          <SearchIcon />
          <input
            id="searchInput" type="search" placeholder={t("Cerca ricette, ingredienti…")} autoComplete="off" value={view.query}
            // Searching from a page without recipes jumps back to the recipes.
            onChange={(event) => setView({ query: event.target.value, page: 1, ...(["stock", "menus", "prep", "rota", "safety", "performance"].includes(view.filter) ? { filter: "all", menuId: null } : {}) })}
          />
          <kbd>⌘ K</kbd>
        </label>
        <StockAlerts />
        <button className="topbar-icon" type="button" onClick={exportJson} aria-label={t("Esporta archivio")} title={t("Esporta archivio (copia di sicurezza in JSON)")}><DownloadIcon /></button>
      </div>
    </header>
  );
}
