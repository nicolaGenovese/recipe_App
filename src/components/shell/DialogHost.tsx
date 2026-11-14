"use client";

import { MenuEditorDialog } from "@/components/menus/MenuEditorDialog";
import { RecipeMenusDialog } from "@/components/menus/RecipeMenusDialog";
import { PrepLabelsDialog } from "@/components/prep/PrepLabelsDialog";
import { PrepListDialog } from "@/components/prep/PrepListDialog";
import { ChecklistDialog } from "@/components/safety/ChecklistDialog";
import { CookingDialog } from "@/components/safety/CookingDialog";
import { DeliveryCheckDialog } from "@/components/safety/DeliveryCheckDialog";
import { SafetySettingsDialog } from "@/components/safety/SafetySettingsDialog";
import { TemperatureDialog } from "@/components/safety/TemperatureDialog";
import { WasteDialog } from "@/components/performance/WasteDialog";
import { PrintDialog } from "@/components/print/PrintDialog";
import { RecipeActionsDialog } from "@/components/recipes/RecipeActionsDialog";
import { RecipeDetailDialog } from "@/components/recipes/RecipeDetailDialog";
import { RecipeEditorDialog } from "@/components/recipes/editor/RecipeEditorDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { StockDeliveryDialog } from "@/components/stock/deliveries/StockDeliveryDialog";
import { StockItemDialog } from "@/components/stock/inventory/StockItemDialog";
import { RecipePickerDialog } from "@/components/stock/picker/RecipePickerDialog";
import { StockReportDialog } from "@/components/stock/reports/StockReportDialog";
import { useApp } from "@/state/AppProvider";

/** Renders whichever dialog is open. Keys reset a dialog's form when another one replaces it. */
export function DialogHost() {
  const { dialog, data } = useApp();
  if (!dialog) return null;
  switch (dialog.kind) {
    case "recipeEditor": return <RecipeEditorDialog key={"editor:" + (dialog.recipe?.id ?? "new")} initial={dialog.recipe} startTab={dialog.tab} />;
    case "recipeDetail": return <RecipeDetailDialog key={"detail:" + dialog.id} id={dialog.id} />;
    case "recipeActions": return <RecipeActionsDialog key={"actions:" + dialog.id} id={dialog.id} />;
    case "print": return <PrintDialog key={"print:" + (dialog.recipeId ?? dialog.menuId ?? "menu")} mode={dialog.mode} recipeId={dialog.recipeId} menuId={dialog.menuId} />;
    case "prepLabels": return <PrepLabelsDialog key={"labels:" + dialog.id} id={dialog.id} />;
    case "safetyTemperature": return <TemperatureDialog key={"temp:" + (dialog.id ?? "new")} id={dialog.id} />;
    case "safetyCooking": return <CookingDialog key={"cook:" + (dialog.id ?? "new:" + (dialog.recipeId ?? ""))} id={dialog.id} recipeId={dialog.recipeId} />;
    case "safetyDelivery": return <DeliveryCheckDialog key={"dcheck:" + (dialog.id ?? "new:" + (dialog.deliveryId ?? ""))} id={dialog.id} deliveryId={dialog.deliveryId} />;
    case "safetyChecklist": return <ChecklistDialog key={"check:" + (dialog.id ?? "new:" + (dialog.list ?? ""))} id={dialog.id} list={dialog.list} />;
    case "safetySettings": return <SafetySettingsDialog />;
    case "waste": return <WasteDialog key={"waste:" + (dialog.id ?? "new")} id={dialog.id} />;
    case "recipeMenus": return <RecipeMenusDialog key={"menus:" + dialog.id} id={dialog.id} />;
    case "menuEditor": return <MenuEditorDialog key={"menu:" + (dialog.id ?? "new")} id={dialog.id} />;
    case "prepList": return <PrepListDialog key={"prep:" + (dialog.id ?? "new:" + (dialog.copyOf ?? dialog.menuId ?? ""))} id={dialog.id} copyOf={dialog.copyOf} menuId={dialog.menuId} />;
    case "settings": return <SettingsDialog initialTab={dialog.tab} />;
    case "stockReport": {
      // Reopening a submitted report turns it back into an editable draft, so the status is part of the key.
      const status = data.stockReports.find((report) => report.id === dialog.id)?.status;
      return <StockReportDialog key={"report:" + dialog.id + ":" + status} id={dialog.id} />;
    }
    case "stockItem": return <StockItemDialog key={"item:" + (dialog.id ?? "new")} id={dialog.id} preset={dialog.preset} />;
    case "stockDelivery": return <StockDeliveryDialog key={"delivery:" + (dialog.id ?? "new")} id={dialog.id} />;
    case "stockPicker": return <RecipePickerDialog />;
  }
}
