"use client";

import { PlusIcon, PrintIcon } from "@/components/ui/icons";
import { useApp } from "@/state/AppProvider";
import type { ViewFilter } from "@/state/view";

const TITLES: Record<ViewFilter, [string, string]> = {
  all: ["Le tue ricette", "Tutto quello che serve, organizzato in un unico posto."],
  menu: ["Piatti in menu", "I piatti dei menu attivi."],
  archive: ["Basi & preparazioni", "Preparazioni riutilizzabili e ricette archiviate."],
  stock: ["Gestione magazzino", "Report periodici, valore delle giacenze e GP della cucina."],
  menus: ["I tuoi menu", "Tutti i menu della cucina: piatti, costi e margini di ognuno."],
  prep: ["Prep list", "Cosa preparare prima del servizio, piatto per piatto."],
  rota: ["Turni del personale", "Chi lavora e quando, settimana per settimana, con le ore calcolate da sole."],
  performance: ["Andamento della cucina", "Vendite, GP teorico e reale, sprechi e costo del personale, settimana per settimana."],
  safety: ["Sicurezza alimentare", "Temperature, cotture, consegne e checklist: i registri da mostrare all'ispettore sanitario."]
};

export function PageIntro() {
  const { data, view, openDialog, t } = useApp();
  const menu = view.filter === "menu" && view.menuId ? data.menus.find((row) => row.id === view.menuId) : undefined;
  const [title, subtitle] = menu ? [menu.name, menu.description || t("I piatti di questo menu.")] : TITLES[view.filter].map(t);
  return (
    <section className="page-intro">
      <div>
        <div className="eyebrow"><span className="eyebrow-dot" /> {t("IL TUO SPAZIO DI LAVORO")}</div>
        <h1>{title}<span className="title-period">.</span></h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {view.filter === "stock" || view.filter === "rota" || view.filter === "safety" || view.filter === "performance" ? null : view.filter === "menus" ? (
        <div className="intro-actions">
          <button className="button button-primary" type="button" onClick={() => openDialog({ kind: "menuEditor" })}><PlusIcon />{t("Nuovo menu")}</button>
        </div>
      ) : view.filter === "prep" ? (
        <div className="intro-actions">
          <button className="button button-primary" type="button" onClick={() => openDialog({ kind: "prepList" })}><PlusIcon />{t("Nuova prep list")}</button>
        </div>
      ) : (
        <div className="intro-actions">
          {menu ? <button className="button button-secondary" type="button" onClick={() => openDialog({ kind: "menuEditor", id: menu.id })}>{t("Modifica menu")}</button> : null}
          <button className="button button-secondary" type="button" onClick={() => openDialog({ kind: "print", menuId: menu?.id })}><PrintIcon />{t("Stampa menu")}</button>
          <button className="button button-primary" type="button" onClick={() => openDialog({ kind: "recipeEditor" })}><PlusIcon />{t("Nuova ricetta")}</button>
        </div>
      )}
    </section>
  );
}
