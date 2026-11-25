"use client";


import { useEffect } from "react";
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
import { useApp } from "@/state/AppProvider";
import { useRecipeActions } from "@/state/actions/useRecipeActions";

/** The whole page: sidebar, top bar and either the recipe library or Food Stock. */
export function RecipeStudio() {
  const { view, setView, t, notify, loaded, can } = useApp();
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
      <div className="app-shell">
        <Sidebar />
        <main className="main-area">
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
