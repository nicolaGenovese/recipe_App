"use client";

import { useRef } from "react";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { GridIcon, ListIcon, PrintIcon, UploadIcon } from "@/components/ui/icons";
import { categoryList, visibleRecipes } from "@/lib/recipes/filter";
import { useApp } from "@/state/AppProvider";
import { useArchiveActions } from "@/state/actions/useArchiveActions";
import { ALL_CATEGORIES, type RecipeSort, type ViewFilter } from "@/state/view";

const SECTION_TITLES: Record<ViewFilter, string> = { all: "Esplora le ricette", menu: "Piatti nel menu", archive: "Basi e preparazioni", stock: "", menus: "", prep: "", rota: "", safety: "", performance: "" };

export function RecipeLibrary() {
  const { data, view, setView, openDialog, onMenu, t, fmt } = useApp();
  const { importJson } = useArchiveActions();
  const fileInput = useRef<HTMLInputElement>(null);
  const recipes = data.recipes;

  const rows = visibleRecipes(recipes, view, data.menus);
  const pickedMenu = view.filter === "menu" && view.menuId ? data.menus.find((menu) => menu.id === view.menuId) : undefined;
  const size = view.pageSize === "all" ? Math.max(1, rows.length) : view.pageSize;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(view.page, pages);
  const from = (page - 1) * size;
  const items = rows.slice(from, from + size);
  const count = (filter: ViewFilter) => recipes.filter((item) => filter === "all" || (filter === "menu" ? onMenu.has(item.id) : item.archivedBatch)).length;

  return (
    <section className="library-section" id="library">
      <div className="section-heading">
        <div>
          <h2>{pickedMenu ? pickedMenu.name : t(SECTION_TITLES[view.filter])}</h2>
          <p>{fmt(rows.length === 1 ? t("{0} ricetta") : t("{0} ricette"), rows.length)}{view.query ? " " + t("per") + " “" + view.query + "”" : ""}</p>
        </div>
        <div className="section-tools">
          <button className="button button-quiet" type="button" onClick={() => fileInput.current?.click()}><UploadIcon />{t("Importa")}</button>
          <button className="button button-quiet" type="button" onClick={() => openDialog({ kind: "print", menuId: pickedMenu?.id })}><PrintIcon />{t("Stampe")}</button>
          <input
            ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json"
            onChange={async (event) => { const file = event.target.files?.[0]; if (file) await importJson(file); event.target.value = ""; }}
          />
        </div>
      </div>

      <div className="category-strip-wrap">
        <div className="category-strip" role="tablist" aria-label={t("Filtra per categoria")}>
          {categoryList(data.settings.categories, recipes).map((category) => {
            const active = view.category === category;
            const total = category === ALL_CATEGORIES ? recipes.length : recipes.filter((item) => item.category === category).length;
            return (
              <button key={category} type="button" role="tab" aria-selected={active} className={"category-chip" + (active ? " active" : "")} onClick={() => setView({ category, page: 1 })}>
                {t(category)}<span className="chip-count">{total}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="category-manage" onClick={() => openDialog({ kind: "settings" })} title={t("Gestisci categorie")} aria-label={t("Gestisci categorie")}>+</button>
      </div>

      <div className="list-controls">
        <div className="filter-tabs" role="group" aria-label={t("Filtra ricette")}>
          {([["all", "Tutte"], ["menu", "In menu"], ["archive", "Basi"]] as [ViewFilter, string][]).map(([filter, label]) => (
            <button key={filter} type="button" className={"filter-tab" + (view.filter === filter && !(filter === "menu" && view.menuId) ? " active" : "")} onClick={() => setView({ filter, menuId: null, category: ALL_CATEGORIES, page: 1 })}>
              {t(label)} <span>{count(filter)}</span>
            </button>
          ))}
        </div>
        <div className="sort-tools">
          <label className="sort-label" htmlFor="sortSelect">{t("Ordina")}</label>
          <select id="sortSelect" aria-label={t("Ordina le ricette")} value={view.sort} onChange={(event) => setView({ sort: event.target.value as RecipeSort, page: 1 })}>
            <option value="updated">{t("Ultima modifica")}</option><option value="name">{t("Nome A–Z")}</option><option value="cost-high">{t("Costo più alto")}</option>
            <option value="cost-low">{t("Costo più basso")}</option><option value="category">{t("Categoria")}</option>
          </select>
          <span className="control-divider" />
          <button type="button" className={"view-toggle" + (view.layout === "grid" ? " active" : "")} onClick={() => setView({ layout: "grid" })} aria-label={t("Vista a schede")} title={t("Vista a schede")}><GridIcon /></button>
          <button type="button" className={"view-toggle" + (view.layout === "list" ? " active" : "")} onClick={() => setView({ layout: "list" })} aria-label={t("Vista elenco")} title={t("Vista elenco")}><ListIcon /></button>
        </div>
      </div>

      <div className={"recipe-grid" + (view.layout === "list" ? " list-layout" : "")} aria-live="polite">
        {items.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-art"><span>✳</span><span>⌕</span></div>
          <h3>{t("Nessuna ricetta qui, per ora")}</h3>
          <p>{t("Prova a cambiare i filtri oppure crea la prima ricetta per questo spazio.")}</p>
          <button className="button button-primary" type="button" onClick={() => openDialog({ kind: "recipeEditor" })}>{t("Crea una ricetta")}</button>
        </div>
      ) : (
        <div className="pagination">
          <span>{fmt(t("Mostrate {0}–{1} di {2} ricette"), from + 1, Math.min(from + size, rows.length), rows.length)}</span>
          <div className="pagination-controls">
            <button className="page-button" type="button" disabled={page === 1} onClick={() => setView({ page: page - 1 })}>‹</button>
            {Array.from({ length: pages }, (_, index) => (
              <button key={index} type="button" className={"page-button" + (index + 1 === page ? " active" : "")} onClick={() => setView({ page: index + 1 })}>{index + 1}</button>
            ))}
            <button className="page-button" type="button" disabled={page === pages} onClick={() => setView({ page: page + 1 })}>›</button>
            <select aria-label={t("Ricette per pagina")} value={String(view.pageSize)} onChange={(event) => setView({ pageSize: event.target.value === "all" ? "all" : Number(event.target.value), page: 1 })}>
              <option value="9">{t("9 per pagina")}</option><option value="18">{t("18 per pagina")}</option><option value="36">{t("36 per pagina")}</option><option value="all">{t("Tutte")}</option>
            </select>
          </div>
        </div>
      )}
    </section>
  );
}
