"use client";

import { useState } from "react";
import { StaffField } from "@/components/safety/fields";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/Field";
import { num } from "@/lib/num";
import { allergens } from "@/lib/recipes/math";
import { useByDate } from "@/lib/safety/rules";
import { useApp } from "@/state/AppProvider";

interface Row { taskId: string; name: string; include: boolean; copies: string; days: string; allergens: string[]; dishes: string }

/** Labels for the jobs of a prep list: what it is, when it was made, use-by date, who made it and its allergens. */
export function PrepLabelsDialog({ id }: { id: string }) {
  const { data, closeDialog, f, t } = useApp();
  const list = data.prepLists.find((row) => row.id === id);
  const fallbackDays = data.settings.foodSafety.defaultShelfLifeDays;
  const recipes = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));

  const [made, setMade] = useState(list?.date ?? "");
  const [by, setBy] = useState("");
  const [rows, setRows] = useState<Row[]>(() => (list?.tasks ?? []).filter((task) => task.name.trim()).map((task) => {
    const base = task.baseRecipeId ? recipes.get(task.baseRecipeId) : undefined;
    return {
      taskId: task.id, name: task.name, include: true, copies: "1", days: String(base?.shelfLifeDays ?? fallbackDays),
      allergens: base ? allergens(base) : [], dishes: task.recipeIds.map((dishId) => recipes.get(dishId)?.name).filter(Boolean).join(", ")
    };
  }));
  if (!list) return null;

  const patch = (taskId: string, change: Partial<Row>) => setRows((old) => old.map((row) => (row.taskId === taskId ? { ...row, ...change } : row)));
  const labels = rows.filter((row) => row.include).flatMap((row) => Array.from({ length: Math.min(50, Math.max(0, Math.round(num(row.copies)))) }, (_, copy) => ({ ...row, key: row.taskId + ":" + copy })));

  return (
    <Dialog size="wide">
      <DialogHeader kicker={t("ETICHETTE")} title={list.name} subtitle={t("Data di preparazione e di scadenza per ogni preparazione. I giorni arrivano dalla ricetta base, se indicati.")} />
      <div className="dialog-body">
        <div className="labels-edit">
          <div className="form-grid">
            <TextField label={t("Preparato il")} name="labelMade" type="date" value={made} onChange={setMade} />
            <StaffField value={by} date={made} onChange={setBy} label={t("Preparato da")} />
          </div>
          <div className="stock-table-wrap">
            <table className="stock-table labels-table">
              <thead><tr><th>{t("Stampa")}</th><th>{t("Preparazione")}</th><th>{t("Giorni")}</th><th>{t("Scadenza")}</th><th>{t("Copie")}</th><th>{t("Allergeni")}</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.taskId}>
                    <td><input type="checkbox" checked={row.include} aria-label={t("Stampa") + " · " + row.name} onChange={(event) => patch(row.taskId, { include: event.target.checked })} /></td>
                    <td>{row.name}</td>
                    <td><input type="number" min="0" step="1" value={row.days} aria-label={t("Giorni")} onChange={(event) => patch(row.taskId, { days: event.target.value })} /></td>
                    <td>{made ? f.stockDate(useByDate(made, num(row.days))) : "—"}</td>
                    <td><input type="number" min="0" max="50" step="1" value={row.copies} aria-label={t("Copie")} onChange={(event) => patch(row.taskId, { copies: event.target.value })} /></td>
                    <td>{row.allergens.length ? row.allergens.map(t).join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length ? null : <p className="field-hint">{t("Questa prep list non ha preparazioni.")}</p>}
          <p className="field-hint">{t("Gli allergeni compaiono quando la preparazione è collegata a una ricetta base con gli allergeni sugli ingredienti.")}</p>
        </div>
        <div className="labels-print">
          {labels.map((label) => (
            <div key={label.key} className="prep-label">
              <strong>{label.name}</strong>
              <span>{t("Preparato")}: {f.stockDate(made)}</span>
              <span className="prep-label-useby">{t("Consumare entro")}: {f.stockDate(useByDate(made, num(label.days)))}</span>
              {by ? <span>{t("Da")}: {by}</span> : null}
              <span>{t("Allergeni")}: {label.allergens.length ? label.allergens.map(t).join(", ") : t("vedi scheda")}</span>
              {label.dishes ? <small>{t("Per")}: {label.dishes}</small> : null}
            </div>
          ))}
        </div>
      </div>
      <footer className="dialog-footer">
        <span className="field-hint">{labels.length} {t("etichette")}</span>
        <div className="dialog-footer-right">
          <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Chiudi")}</button>
          <button className="button button-primary" type="button" disabled={!labels.length || !made} onClick={() => window.print()}>{t("Stampa etichette")}</button>
        </div>
      </footer>
    </Dialog>
  );
}
