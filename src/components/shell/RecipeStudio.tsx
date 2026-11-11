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
import { Toast } from "@/components/ui/bits";
import { useApp } from "@/state/AppProvider";
import { useRecipeActions } from "@/state/actions/useRecipeActions";

/** The whole page: sidebar, top bar and either the recipe library or Food Stock. */
export function RecipeStudio() {
  const { view, openDialog, t, notify, loaded } = useApp();
  const { syncRecipeCosts } = useRecipeActions();

  // Product prices may have changed since recipes were last saved.
  useEffect(() => {
    if (loaded) syncRecipeCosts().catch((error) => notify(t(error instanceof Error ? error.message : String(error)), true));
    // Runs once the archive is in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // ⌘K / Ctrl+K jumps to the search box.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("searchInput")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="main-area">
          <Topbar />
          <div className="content-wrap">
            <PageIntro />
            {view.filter === "stock" ? <StockView /> : view.filter === "menus" ? <MenusView /> : view.filter === "prep" ? <PrepView /> : view.filter === "rota" ? <RotaView /> : view.filter === "safety" ? <SafetyView /> : view.filter === "performance" ? <PerformanceView /> : <><OverviewCards /><RecipeLibrary /></>}
            <footer className="page-footer">
              <span>Recipe Studio <span className="footer-dot">·</span> {t("uno spazio fatto per ogni cucina")}</span>
              <button type="button" onClick={() => openDialog({ kind: "settings" })}>{t("Personalizza il tuo spazio")} <span aria-hidden="true">↗</span></button>
            </footer>
          </div>
        </main>
      </div>
      <DialogHost />
      <Toast />
    </>
  );
}
