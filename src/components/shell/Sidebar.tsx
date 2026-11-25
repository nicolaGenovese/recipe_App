"use client";

import { useState, type ReactNode } from "react";
import { BoxIcon, BrandIcon, CalendarIcon, ChartIcon, ClipboardIcon, ShieldIcon, GearIcon, GridIcon, LeafIcon, MenuIcon, PlateIcon, PotIcon } from "@/components/ui/icons";
import { availabilityLabel, dayNames } from "@/lib/menus/availability";
import { sortMenus } from "@/lib/menus/menus";
import { localeFor } from "@/lib/i18n";
import { KITCHEN_KEY } from "@/lib/kitchen/today";
import { useApp } from "@/state/AppProvider";
import { ALL_CATEGORIES, type ViewFilter, type ViewState } from "@/state/view";

/** A page in the navigation. "Ingredients" is the inventory tab of Food Stock, offered on its own. */
interface NavItem { key: ViewFilter | "ingredients"; label: string; icon: ReactNode; count: number; active: boolean; open: () => void }

export function Sidebar() {
  const { data, view, setView, stockView, setStockView, openDialog, health, t, accessProtected, language, access, can, switchSite, logout } = useApp();
  const dayName = dayNames(localeFor(language));
  const { recipes } = data;
  const go = (change: Partial<ViewState>) => setView({ menuId: null, category: ALL_CATEGORIES, page: 1, ...change });
  const onInventory = view.filter === "stock" && stockView.tab === "inventory";
  const page = (key: ViewFilter, label: string, icon: ReactNode, count: number): NavItem => ({ key, label, icon, count, active: view.filter === key, open: () => go({ filter: key }) });
  const stockAllowed = can("stock.manage") || can("stock.count") || can("stock.deliveries");
  // The order of the kitchen's day: what goes in (ingredients, bases), the dishes and menus, the work, then the numbers.
  const items: NavItem[] = [
    ...(stockAllowed ? [{
      key: "ingredients" as const, label: t("Ingredienti"), icon: <LeafIcon key="i" />, count: data.stockItems.length, active: onInventory,
      open: () => { go({ filter: "stock" }); setStockView({ tab: "inventory", page: 1 }); }
    }] : []),
    page("archive", t("Ricette base"), <PotIcon key="i" />, recipes.filter((item) => item.archivedBatch).length),
    page("all", t("Ricette"), <GridIcon key="i" />, recipes.length),
    page("menus", t("Menu"), <MenuIcon key="i" />, data.menus.length),
    page("prep", t("Prep list"), <ClipboardIcon key="i" />, data.prepLists.length),
    page("safety", t("Sicurezza alimentare"), <ShieldIcon key="i" />, data.safetyLogs.length),
    ...(stockAllowed ? [{
      key: "stock" as const, label: t("Food Stock"), icon: <BoxIcon key="i" />, count: data.stockReports.length, active: view.filter === "stock" && !onInventory,
      // From Ingredients, Food Stock opens on its reports rather than staying on the inventory.
      open: () => { go({ filter: "stock" }); if (stockView.tab === "inventory") setStockView({ tab: "reports", page: 1 }); }
    }] : []),
    // Pages a role cannot use are not offered; the server refuses them anyway.
    ...(can("sales.view") ? [page("performance", t("Andamento"), <ChartIcon key="i" />, data.salesWeeks.length)] : []),
    page("rota", t("Turni"), <CalendarIcon key="i" />, data.rotaWeeks.length)
  ];
  // Settings hold the kitchen lists and staff, and the company: people, sites, roles, activity log.
  const showSettings = can("settings.company") || can("orders.setup") || can("menus.edit") || (Boolean(access) && (can("users.manage") || can("company.manage") || can("audit.view")));
  // Each active menu gets a shortcut under "Menu" that shows its dishes.
  const menuLinks = sortMenus(data.menus).filter((menu) => menu.active);
  // With more than one menu the shortcuts sit in a dropdown under "Menu", open while one of them is shown.
  const dropdown = menuLinks.length > 1;
  // null until the arrow is used: then it opens by itself while a menu is shown.
  const [menusOpen, setMenusOpen] = useState<boolean | null>(null);
  const showMenus = !dropdown || (menusOpen ?? view.filter === "menu");
  // Phones: a tab bar at the bottom with the pages used most, everything else under "Altro".
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs: ViewFilter[] = ["all", "menus", "prep", "safety"];
  const inMore = !tabs.includes(view.filter) && view.filter !== "menu";
  const openFromSheet = (item: NavItem) => { setMoreOpen(false); item.open(); };
  const enterKitchen = () => {
    setMoreOpen(false);
    try { window.localStorage.setItem(KITCHEN_KEY, "1"); } catch { /* Kitchen mode then lasts until the page is reloaded. */ }
    setView({ filter: "kitchen" });
  };
  const storageLabel = !health ? t("Controllo l'archivio…") : health.storage === "neon" ? "Neon Postgres" : t("Archivio in locale");

  return (
    <>
    <aside className="sidebar" aria-label={t("Navigazione principale")}>
      <a className="brand" href="#" aria-label={t("Recipe Studio, ricette")} onClick={(event) => { event.preventDefault(); go({ filter: "all" }); }}>
        <span className="brand-mark" aria-hidden="true"><BrandIcon /></span>
        <span className="brand-copy"><strong>{t("ricetta")}</strong><small>studio</small></span>
      </a>

      <SitePicker />

      <div className="nav-label">{t("GESTIONE")}</div>
      <nav className="side-nav">
        {/* The schedule sits at the bottom of the column, with kitchen mode and settings. */}
        {items.filter((item) => item.key !== "rota").map(({ key, label, icon, count, active, open }) => (
          <div key={key} className="nav-group">
            <div className={"nav-row" + (key === "menus" && dropdown ? " has-toggle" : "")}>
              <button className={"nav-item" + (active ? " active" : "")} aria-current={active ? "page" : undefined} type="button" onClick={open}>
                <span className="nav-icon" aria-hidden="true">{icon}</span>
                <span>{label}</span><span className="nav-count">{count}</span>
              </button>
              {key === "menus" && dropdown ? (
                <button type="button" className={"nav-toggle" + (showMenus ? " open" : "")} aria-expanded={showMenus} aria-controls="sidebarMenus"
                  aria-label={t(showMenus ? "Nascondi i menu" : "Mostra i menu")} title={t(showMenus ? "Nascondi i menu" : "Mostra i menu")}
                  onClick={() => setMenusOpen(!showMenus)}>⌄</button>
              ) : null}
            </div>
            {key === "menus" && showMenus ? <div id="sidebarMenus" className="nav-submenu">{menuLinks.map((menu) => (
              <button key={menu.id} className={"nav-item nav-sub" + (view.filter === "menu" && view.menuId === menu.id ? " active" : "")} aria-current={view.filter === "menu" && view.menuId === menu.id ? "page" : undefined} type="button" onClick={() => go({ filter: "menu", menuId: menu.id })}
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
        {items.filter((item) => item.key === "rota").map(({ key, label, icon, count, active, open }) => (
          <button key={key} className={"nav-item settings-link" + (active ? " active" : "")} aria-current={active ? "page" : undefined} type="button" onClick={open}>
            <span className="nav-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span><span className="nav-count">{count}</span>
          </button>
        ))}
        <button className="nav-item settings-link kitchen-link" type="button" onClick={enterKitchen}>
          <span className="nav-icon" aria-hidden="true"><PlateIcon /></span>
          <span>{t("Modalità cucina")}</span>
        </button>
        {showSettings ? (
          <button className="nav-item settings-link" type="button" onClick={() => openDialog({ kind: "settings" })}>
            <span className="nav-icon" aria-hidden="true"><GearIcon /></span>
            <span>{t("Impostazioni")}</span>
          </button>
        ) : null}
        {accessProtected ? (
          <button className="nav-item settings-link" type="button" onClick={logout}>
            <span className="nav-icon" aria-hidden="true">⎋</span>
            <span>{t("Esci")}</span>
          </button>
        ) : null}
      </div>
    </aside>

    <nav className="mobile-tabbar" aria-label={t("Navigazione principale")}>
      {items.filter((item) => (tabs as string[]).includes(item.key)).map((item) => {
        const active = item.active || (item.key === "menus" && view.filter === "menu");
        return (
          <button key={item.key} type="button" className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => openFromSheet(item)}>
            {item.icon}<span>{item.key === "safety" ? t("Sicurezza") : item.label}</span>
          </button>
        );
      })}
      <button type="button" className={inMore || moreOpen ? "active" : ""} aria-expanded={moreOpen} aria-controls="mobileMore" onClick={() => setMoreOpen(!moreOpen)}>
        <span className="tabbar-dots" aria-hidden="true">···</span><span>{t("Altro|nav")}</span>
      </button>
    </nav>
    {moreOpen ? (
      <div className="mobile-sheet-backdrop" onClick={() => setMoreOpen(false)}>
        <div id="mobileMore" className="mobile-sheet" role="dialog" aria-label={t("Altro|nav")} onClick={(event) => event.stopPropagation()}>
          {access && access.sites.length > 1 ? <div className="mobile-sheet-site"><SitePicker /></div> : null}
          <button className="mobile-sheet-kitchen" type="button" onClick={enterKitchen}><PlateIcon /><span><strong>{t("Modalità cucina")}</strong><small>{t("Prep list, temperature e checklist con pulsanti grandi")}</small></span></button>
          <div className="mobile-sheet-grid">
            {items.map((item) => (
              <button key={item.key} type="button" className={item.active ? "active" : ""} aria-current={item.active ? "page" : undefined} onClick={() => openFromSheet(item)}>{item.icon}<span>{item.label}</span><small>{item.count}</small></button>
            ))}
          </div>
          {menuLinks.length ? (
            <div className="mobile-sheet-menus">
              <span>{t("Menu")}</span>
              {menuLinks.map((menu) => <button key={menu.id} type="button" className={view.filter === "menu" && view.menuId === menu.id ? "active" : ""} aria-current={view.filter === "menu" && view.menuId === menu.id ? "page" : undefined} onClick={() => { setMoreOpen(false); go({ filter: "menu", menuId: menu.id }); }}>{menu.name}</button>)}
            </div>
          ) : null}
          <div className="mobile-sheet-foot">
            {showSettings ? <button type="button" onClick={() => { setMoreOpen(false); openDialog({ kind: "settings" }); }}><GearIcon /> {t("Impostazioni")}</button> : null}
            {accessProtected ? <button type="button" onClick={logout}>⎋ {t("Esci")}</button> : null}
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

/**
 * Company and site at the top of the sidebar. With more than one site (or company) it is a picker;
 * in local mode it shows the single kitchen.
 */
export function SitePicker() {
  const { access, switchSite, t } = useApp();
  if (!access) {
    return (
      <div className="workspace-switcher">
        <span className="workspace-avatar">K</span>
        <span className="workspace-copy"><strong>{t("La mia cucina")}</strong><small>{t("Spazio di lavoro")}</small></span>
      </div>
    );
  }
  const companies = Array.from(new Map(access.sites.map((site) => [site.companyId, site.companyName])));
  return (
    <div className="workspace-switcher">
      <span className="workspace-avatar">{(access.site.name.trim()[0] ?? "K").toUpperCase()}</span>
      <span className="workspace-copy">
        <strong>{access.site.name}</strong>
        <small>{access.company.name}</small>
      </span>
      {access.sites.length > 1 ? (
        <select className="workspace-select" aria-label={t("Cambia sede")} value={access.site.id} onChange={(event) => void switchSite(event.target.value)}>
          {companies.map(([companyId, companyName]) => (
            <optgroup key={companyId} label={companyName}>
              {access.sites.filter((site) => site.companyId === companyId).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </optgroup>
          ))}
        </select>
      ) : null}
    </div>
  );
}
