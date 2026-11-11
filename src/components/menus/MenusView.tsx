"use client";

import { MenuCard } from "@/components/menus/MenuCard";
import { sortMenus } from "@/lib/menus/menus";
import { useApp } from "@/state/AppProvider";

/** Every menu of the kitchen as a card with its numbers. */
export function MenusView() {
  const { data, openDialog, t } = useApp();
  const menus = sortMenus(data.menus);

  if (!menus.length) {
    return (
      <section className="empty-state">
        <div className="empty-art"><span>✳</span><span>☰</span></div>
        <h3>{t("Nessun menu, per ora")}</h3>
        <p>{t("Crea un menu per ogni servizio: menu principale, pizze, Sunday roast…")}</p>
        <button className="button button-primary" type="button" onClick={() => openDialog({ kind: "menuEditor" })}>{t("Crea un menu")}</button>
      </section>
    );
  }
  return <section className="menu-grid">{menus.map((menu) => <MenuCard key={menu.id} menu={menu} />)}</section>;
}
