"use client";

import { useState, type ReactNode } from "react";
import { ArchiveIcon, BoxIcon, BrandIcon, CalendarIcon, ChartIcon, ClipboardIcon, ShieldIcon, GearIcon, GridIcon, MenuIcon } from "@/components/ui/icons";
import { sortMenus } from "@/lib/menus/menus";
import { useApp } from "@/state/AppProvider";
import { ALL_CATEGORIES, type ViewFilter, type ViewState } from "@/state/view";

export function Sidebar() {
  const { data, view, setView, openDialog, health, t, accessProtected } = useApp();
  const { recipes } = data;
  const items: [ViewFilter, string, ReactNode, number][] = [
    ["all", t("Tutte le ricette"), <GridIcon key="i" />, recipes.length],
    ["menus", t("Menu"), <MenuIcon key="i" />, data.menus.length],
    ["archive", t("Basi e archivio"), <ArchiveIcon key="i" />, recipes.filter((item) => item.archivedBatch).length],
    ["prep", t("Prep list"), <ClipboardIcon key="i" />, data.prepLists.length],
    ["rota", t("Turni"), <CalendarIcon key="i" />, data.rotaWeeks.length],
    ["safety", t("Sicurezza alimentare"), <ShieldIcon key="i" />, data.safetyLogs.length],
    ["performance", t("Andamento"), <ChartIcon key="i" />, data.salesWeeks.length],
    ["stock", t("Food Stock"), <BoxIcon key="i" />, data.stockItems.length]
  ];
  // Each active menu gets a shortcut under "Menu" that shows its dishes.
  const menuLinks = sortMenus(data.menus).filter((menu) => menu.active);
  // With more than one menu the shortcuts sit in a dropdown under "Menu", open while one of them is shown.
  const dropdown = menuLinks.length > 1;
  // null until the arrow is used: then it opens by itself while a menu is shown.
  const [menusOpen, setMenusOpen] = useState<boolean | null>(null);
  const showMenus = !dropdown || (menusOpen ?? view.filter === "menu");
  const go = (change: Partial<ViewState>) => setView({ menuId: null, category: ALL_CATEGORIES, page: 1, ...change });
  const storageLabel = health?.storage === "neon" ? "Neon Postgres" : t("Archivio in locale");

  return (
    <aside className="sidebar" aria-label={t("Navigazione principale")}>
      <a className="brand" href="#" aria-label={t("Recipe Studio, ricette")} onClick={(event) => { event.preventDefault(); go({ filter: "all" }); }}>
        <span className="brand-mark" aria-hidden="true"><BrandIcon /></span>
        <span className="brand-copy"><strong>{t("ricetta")}</strong><small>studio</small></span>
      </a>

      <div className="workspace-switcher">
        <span className="workspace-avatar">K</span>
        <span className="workspace-copy"><strong>{t("La mia cucina")}</strong><small>{t("Spazio di lavoro")}</small></span>
        <span className="switcher-chevron" aria-hidden="true">⌄</span>
      </div>

      <div className="nav-label">{t("GESTIONE")}</div>
      <nav className="side-nav">
        {items.map(([filter, label, icon, count]) => (
          <div key={filter} className="nav-group">
            <div className={"nav-row" + (filter === "menus" && dropdown ? " has-toggle" : "")}>
              <button className={"nav-item" + (view.filter === filter ? " active" : "")} type="button" onClick={() => go({ filter })}>
                <span className="nav-icon" aria-hidden="true">{icon}</span>
                <span>{label}</span><span className="nav-count">{count}</span>
              </button>
              {filter === "menus" && dropdown ? (
                <button type="button" className={"nav-toggle" + (showMenus ? " open" : "")} aria-expanded={showMenus} aria-controls="sidebarMenus"
                  aria-label={t(showMenus ? "Nascondi i menu" : "Mostra i menu")} title={t(showMenus ? "Nascondi i menu" : "Mostra i menu")}
                  onClick={() => setMenusOpen(!showMenus)}>⌄</button>
              ) : null}
            </div>
            {filter === "menus" && showMenus ? <div id="sidebarMenus" className="nav-submenu">{menuLinks.map((menu) => (
              <button key={menu.id} className={"nav-item nav-sub" + (view.filter === "menu" && view.menuId === menu.id ? " active" : "")} type="button" onClick={() => go({ filter: "menu", menuId: menu.id })}>
                <span className="nav-icon" aria-hidden="true">·</span>
                <span>{menu.name}</span><span className="nav-count">{menu.recipeIds.filter((id) => recipes.some((recipe) => recipe.id === id)).length}</span>
              </button>
            ))}</div> : null}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className={"storage-status" + (health && !health.connected ? " storage-error" : "")} title={health?.error || t("Archivio pronto")}>
          <span className="status-dot" />
          <span>{storageLabel}{health && !health.connected ? " · " + t("non collegato") : ""}</span>
        </div>
        <button className="nav-item settings-link" type="button" onClick={() => openDialog({ kind: "settings" })}>
          <span className="nav-icon" aria-hidden="true"><GearIcon /></span>
          <span>{t("Impostazioni")}</span>
        </button>
        {accessProtected ? (
          <button className="nav-item settings-link" type="button" onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.assign("/login"); }}>
            <span className="nav-icon" aria-hidden="true">⎋</span>
            <span>{t("Esci")}</span>
          </button>
        ) : null}
        <div className="sidebar-user"><span className="user-avatar">C</span><span><strong>{t("Team cucina")}</strong><small>{t("Workspace personale")}</small></span><span className="user-more">···</span></div>
      </div>
    </aside>
  );
}
