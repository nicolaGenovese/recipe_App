"use client";

import { portionCost } from "@/lib/recipes/math";
import { useApp } from "@/state/AppProvider";

export function OverviewCards() {
  const { data, onMenu, f, t, fmt } = useApp();
  const activeMenus = data.menus.filter((menu) => menu.active).length;
  const recipes = data.recipes;
  const costed = recipes.filter((recipe) => (recipe.ingredients || []).length);
  const averageCost = costed.length ? costed.reduce((total, item) => total + portionCost(item), 0) / costed.length : 0;

  return (
    <section className="overview-grid" aria-label={t("Riepilogo")}>
      <article className="overview-card overview-total">
        <div className="overview-label">{t("RICETTE IN ARCHIVIO")}</div>
        <div className="overview-value">{recipes.length}</div>
        <div className="overview-foot"><span className="small-badge">∞</span> {t("La tua libreria, in crescita")}</div>
        <div className="stat-sparkline" aria-hidden="true">
          <svg viewBox="0 0 165 48" preserveAspectRatio="none"><path d="M2 38 23 33 42 35 62 24 80 28 101 16 122 20 144 8 163 11" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M2 38 23 33 42 35 62 24 80 28 101 16 122 20 144 8 163 11V48H2Z" fill="currentColor" opacity=".09" /></svg>
        </div>
      </article>
      <article className="overview-card">
        <div className="overview-label">{t("PIATTI IN MENU")}</div>
        <div className="overview-value">{recipes.filter((item) => onMenu.has(item.id)).length}</div>
        <div className="overview-foot"><span className="status-ring" /> {fmt(activeMenus === 1 ? t("Su {0} menu attivo") : t("Su {0} menu attivi"), activeMenus)}</div>
        <div className="mini-dots" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
      </article>
      <article className="overview-card">
        <div className="overview-label">{t("COSTO MEDIO / PORZIONE")}</div>
        <div className="overview-value">{f.money(averageCost)}</div>
        <div className="overview-foot">{t("Sulle ricette con ingredienti e costi")}</div>
        <div className="cost-orbit" aria-hidden="true"><span /><span /><span /></div>
      </article>
      <article className="overview-card overview-archive">
        <div className="overview-label">{t("BASI & PREPARAZIONI")}</div>
        <div className="overview-value">{recipes.filter((item) => item.archivedBatch).length}</div>
        <div className="overview-foot">{t("Preparazioni riutilizzabili")}</div>
        <div className="archive-illustration" aria-hidden="true"><span /><span /><span /></div>
      </article>
    </section>
  );
}
