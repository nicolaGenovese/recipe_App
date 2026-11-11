"use client";

import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useRecipeActions } from "@/state/actions/useRecipeActions";

/** The "···" menu on a recipe card. */
export function RecipeActionsDialog({ id }: { id: string }) {
  const { data, openDialog, t } = useApp();
  const guard = useGuard();
  const actions = useRecipeActions();
  const recipe = data.recipes.find((item) => item.id === id);
  if (!recipe) return null;

  const options: [string, string, () => unknown][] = [
    [t("Modifica"), t("Aggiorna ingredienti, istruzioni e costi."), () => openDialog({ kind: "recipeEditor", recipe })],
    [t("Duplica"), t("Crea una copia modificabile."), () => actions.cloneRecipe(id)],
    [t("Menu"), t("Scegli in quali menu compare questo piatto."), () => openDialog({ kind: "recipeMenus", id })],
    [recipe.archivedBatch ? t("Rimuovi dalle basi") : t("Salva come base"), t("Organizza le preparazioni riutilizzabili."), () => actions.toggleArchive(id)],
    [t("Elimina"), t("Rimuove la scheda dall'archivio."), () => actions.deleteRecipe(id)]
  ];

  return (
    <Dialog>
      <DialogHeader kicker={t("AZIONI RICETTA")} title={recipe.name} subtitle={t("Scegli cosa fare con questa scheda.")} />
      <div className="dialog-body">
        <div className="print-options">
          {options.map(([label, description, run]) => (
            <button key={label} className="print-option" type="button" onClick={guard(run)}><span><strong>{label}</strong><small>{description}</small></span></button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
