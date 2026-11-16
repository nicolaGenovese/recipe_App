"use client";

import { useState, type ReactNode } from "react";
import { ArchiveIcon, BoxIcon, BrandIcon, CalendarIcon, ChartIcon, ClipboardIcon, ShieldIcon, GearIcon, GridIcon, MenuIcon, PlateIcon } from "@/components/ui/icons";
import { availabilityLabel, dayNames } from "@/lib/menus/availability";
import { sortMenus } from "@/lib/menus/menus";
import { localeFor } from "@/lib/i18n";
import { KITCHEN_KEY, KITCHEN_LEFT_KEY } from "@/lib/kitchen/today";
import { useApp } from "@/state/AppProvider";
import { ALL_CATEGORIES, type ViewFilter, type ViewState } from "@/state/view";

export function Sidebar() {
  const { data, view, setView, openDialog, health, t, accessProtected, language } = useApp();
  const dayName = dayNames(localeFor(language));
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
  // Phones: a tab bar at the bottom with the pages used most, everything else under "Altro".
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs: ViewFilter[] = ["all", "menus", "prep", "safety"];
  const inMore = !tabs.includes(view.filter) && view.filter !== "menu";
  const goFromSheet = (change: Partial<ViewState>) => { setMoreOpen(false); go(change); };
  const enterKitchen = () => {
    setMoreOpen(false);
    try { window.localStorage.setItem(KITCHEN_KEY, "1"); window.sessionStorage.removeItem(KITCHEN_LEFT_KEY); } catch { /* Kitchen mode then lasts until the page is reloaded. */ }
    setView({ filter: "kitchen" });
  };
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); window.location.assign("/login"); };
  const storageLabel = health?.storage === "neon" ? "Neon Postgres" : t("Archivio in locale");

  return (
    <>
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
              <button key={menu.id} className={"nav-item nav-sub" + (view.filter === "menu" && view.menuId === menu.id ? " active" : "")} type="button" onClick={() => go({ filter: "menu", menuId: menu.id })}
                title={availabilityLabel(menu, dayName, t("Tutti i giorni")) || undefined}>
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
        <button className="nav-item settings-link kitchen-link" type="button" onClick={enterKitchen}>
          <span className="nav-icon" aria-hidden="true"><PlateIcon /></span>
          <span>{t("Modalità cucina")}</span>
        </button>
        <button className="nav-item settings-link" type="button" onClick={() => openDialog({ kind: "settings" })}>
          <span className="nav-icon" aria-hidden="true"><GearIcon /></span>
          <span>{t("Impostazioni")}</span>
        </button>
        {accessProtected ? (
          <button className="nav-item settings-link" type="button" onClick={logout}>
            <span className="nav-icon" aria-hidden="true">⎋</span>
            <span>{t("Esci")}</span>
          </button>
        ) : null}
        <div className="sidebar-user"><span className="user-avatar">C</span><span><strong>{t("Team cucina")}</strong><small>{t("Workspace personale")}</small></span><span className="user-more">···</span></div>
      </div>
    </aside>

    <nav className="mobile-tabbar" aria-label={t("Navigazione principale")}>
      {items.filter(([filter]) => tabs.includes(filter)).map(([filter, label, icon]) => (
        <button key={filter} type="button" className={view.filter === filter || (filter === "menus" && view.filter === "menu") ? "active" : ""} onClick={() => { setMoreOpen(false); go({ filter }); }}>
          {icon}<span>{filter === "all" ? t("Ricette") : filter === "safety" ? t("Sicurezza") : label}</span>
        </button>
      ))}
      <button type="button" className={inMore || moreOpen ? "active" : ""} aria-expanded={moreOpen} aria-controls="mobileMore" onClick={() => setMoreOpen(!moreOpen)}>
        <span className="tabbar-dots" aria-hidden="true">···</span><span>{t("Altro")}</span>
      </button>
    </nav>
    {moreOpen ? (
      <div className="mobile-sheet-backdrop" onClick={() => setMoreOpen(false)}>
        <div id="mobileMore" className="mobile-sheet" role="dialog" aria-label={t("Altro")} onClick={(event) => event.stopPropagation()}>
          <button className="mobile-sheet-kitchen" type="button" onClick={enterKitchen}><PlateIcon /><span><strong>{t("Modalità cucina")}</strong><small>{t("Prep list, temperature e checklist con pulsanti grandi")}</small></span></button>
          <div className="mobile-sheet-grid">
            {items.map(([filter, label, icon, count]) => (
              <button key={filter} type="button" className={view.filter === filter ? "active" : ""} onClick={() => goFromSheet({ filter })}>{icon}<span>{label}</span><small>{count}</small></button>
            ))}
          </div>
          {menuLinks.length ? (
            <div className="mobile-sheet-menus">
              <span>{t("Menu")}</span>
              {menuLinks.map((menu) => <button key={menu.id} type="button" className={view.filter === "menu" && view.menuId === menu.id ? "active" : ""} onClick={() => goFromSheet({ filter: "menu", menuId: menu.id })}>{menu.name}</button>)}
            </div>
          ) : null}
          <div className="mobile-sheet-foot">
            <button type="button" onClick={() => { setMoreOpen(false); openDialog({ kind: "settings" }); }}><GearIcon /> {t("Impostazioni")}</button>
            {accessProtected ? <button type="button" onClick={logout}>⎋ {t("Esci")}</button> : null}
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
