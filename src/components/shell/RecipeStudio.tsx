"use client";


import { useEffect, useState } from "react";
import { DialogHost } from "@/components/shell/DialogHost";
import { PageIntro } from "@/components/shell/PageIntro";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { OverviewCards } from "@/components/recipes/OverviewCards";
import { RecipeLibrary } from "@/components/recipes/RecipeLibrary";
import { StockView } from "@/components/stock/StockView";
import { MenusView } from "@/components/menus/MenusView";
import { PrepView } from "@/components/prep/PrepView";
import { RotaView } from "@/components/rota/RotaView";
import { SafetyView } from "@/components/safety/SafetyView";
import { PerformanceView } from "@/components/performance/PerformanceView";
import { KitchenMode, ORDERS_ONLY_KEY, PANEL_KEY, STATION_KEY } from "@/components/kitchen/KitchenMode";
import { KITCHEN_KEY, opensInKitchen } from "@/lib/kitchen/today";
import { Toast } from "@/components/ui/bits";
import { BrandIcon } from "@/components/ui/icons";
import { useApp } from "@/state/AppProvider";
import { useRecipeActions } from "@/state/actions/useRecipeActions";

/**
 * Shown when the archive could not be read at all. Without it the app would look like an empty
 * kitchen and invite people to start again from nothing.
 */
function LoadError({ message }: { message: string }) {
  const { t, reload, logout, accessProtected } = useApp();
  const [trying, setTrying] = useState(false);
  const retry = async () => { setTrying(true); await reload(); setTrying(false); };
  return (
    <main className="load-error" id="main-content">
      <div className="load-error-card" role="alert">
        <span className="brand-mark" aria-hidden="true"><BrandIcon /></span>
        <h1>{t("Non riesco a caricare i dati della cucina")}</h1>
        <p>{message}</p>
        <p className="load-error-hint">{t("Non è stato cancellato niente: i dati restano nell'archivio e tornano appena la connessione riprende.")}</p>
        <div className="load-error-actions">
          <button className="button button-primary" type="button" disabled={trying} onClick={() => void retry()}>{t(trying ? "Riprovo…" : "Riprova")}</button>
          {accessProtected ? <button className="button button-secondary" type="button" onClick={() => void logout()}>{t("Esci")}</button> : null}
        </div>
      </div>
    </main>
  );
}

/** The whole page: sidebar, top bar and either the recipe library or Food Stock. */
export function RecipeStudio() {
  const { view, setView, t, notify, loaded, loadError, can } = useApp();
  // Roles without "costs.view" get zeros from the server; the cost figures are hidden instead of showing £0.00.
  const hideCosts = !can("costs.view");
  useEffect(() => { document.body.classList.toggle("no-costs", hideCosts); }, [hideCosts]);
  const hidePay = !can("pay.view");
  useEffect(() => { document.body.classList.toggle("no-pay", hidePay); }, [hidePay]);
  const { syncRecipeCosts } = useRecipeActions();

  // Product prices may have changed since recipes were last saved.
  useEffect(() => {
    if (loaded) syncRecipeCosts().catch((error) => notify(t(error instanceof Error ? error.message : String(error)), true));
    // Runs once the archive is in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Phones and tablets open in kitchen mode until someone leaves it on that device; links ending in ?cucina always do.
  useEffect(() => {
    let stored = "";
    try { stored = window.localStorage.getItem(KITCHEN_KEY) ?? ""; } catch { /* No storage: decide from the device. */ }
    const params = new URLSearchParams(window.location.search);
    // ?comande (or ?orders) opens a screen for orders only; &partita=Forno fixes it on a station.
    const ordersLink = params.has("comande") || params.has("orders");
    const link = params.has("cucina") || params.has("kitchen") || ordersLink;
    if (link) {
      try {
        window.localStorage.setItem(KITCHEN_KEY, "1");
        if (ordersLink) {
          window.localStorage.setItem(PANEL_KEY, "orders");
          window.localStorage.setItem(ORDERS_ONLY_KEY, "1");
          const station = params.get("partita") ?? params.get("station");
          if (station !== null) { if (station.trim()) window.localStorage.setItem(STATION_KEY, station.trim()); else window.localStorage.removeItem(STATION_KEY); }
        }
      } catch { /* No storage: kitchen mode lasts until reload. */ }
      // Drop ?cucina from the address, so leaving kitchen mode and reloading does not bring it back.
      window.history.replaceState(null, "", window.location.pathname);
    }
    const touch = window.matchMedia("(pointer: coarse) and (hover: none)").matches;
    if (opensInKitchen({ link, stored, touch })) setView({ filter: "kitchen" });
  }, [setView]);

  // ⌘K / Ctrl+K jumps to the search box.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!document.getElementById("searchInput")) setView({ filter: "all", menuId: null, page: 1 });
        window.setTimeout(() => document.getElementById("searchInput")?.focus(), 50);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (loadError) return <><LoadError message={loadError} /><Toast /></>;
  // The server could not send the data with the page: wait for them instead of showing an empty kitchen.
  if (!loaded) return <main className="load-error" id="main-content"><p className="load-waiting" role="status">{t("Carico i dati della cucina…")}</p></main>;

  if (view.filter === "kitchen") {
    return (
      <>
        <KitchenMode />
        <DialogHost />
        <Toast />
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main-content">{t("Vai al contenuto")}</a>
      <div className="app-shell">
        <Sidebar />
        <main className="main-area" id="main-content" tabIndex={-1}>
          <Topbar />
          <div className="content-wrap">
            <PageIntro />
            {view.filter === "stock" ? <StockView /> : view.filter === "menus" ? <MenusView /> : view.filter === "prep" ? <PrepView /> : view.filter === "rota" ? <RotaView /> : view.filter === "safety" ? <SafetyView /> : view.filter === "performance" ? <PerformanceView /> : <><OverviewCards /><RecipeLibrary /></>}
          </div>
        </main>
      </div>
      <DialogHost />
      <Toast />
    </>
  );
}
