"use client";

import { StockAlerts } from "@/components/shell/StockAlerts";
import { DownloadIcon, SearchIcon } from "@/components/ui/icons";
import { useApp } from "@/state/AppProvider";
import { useArchiveActions } from "@/state/actions/useArchiveActions";
import type { ViewFilter } from "@/state/view";

const CRUMBS: Record<ViewFilter, string> = { all: "Ricette", menu: "In menu", archive: "Basi e archivio", stock: "Food Stock", menus: "Menu", prep: "Prep list", rota: "Turni", safety: "Sicurezza alimentare", performance: "Andamento" };

export function Topbar() {
  const { data, view, setView, t } = useApp();
  const menu = view.filter === "menu" && view.menuId ? data.menus.find((row) => row.id === view.menuId) : undefined;
  const { exportJson } = useArchiveActions();

  return (
    <header className="topbar">
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
        <button className="topbar-icon" type="button" onClick={exportJson} aria-label={t("Esporta archivio")} title={t("Esporta archivio")}><DownloadIcon /></button>
        <span className="topbar-avatar" title={t("Team cucina")}>C</span>
      </div>
    </header>
  );
}
