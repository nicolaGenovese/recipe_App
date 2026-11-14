"use client";

import type { FormPatch } from "@/components/recipes/editor/RecipeEditorDialog";
import { AllergenPicker } from "@/components/ui/AllergenPicker";
import { CheckPill, FieldShell, TextAreaField, TextField } from "@/components/ui/Field";
import { allergenSources, allergenStatus } from "@/lib/recipes/allergens";
import { resolveRecipe } from "@/lib/recipes/catalog";
import { fromForm, type RecipeForm } from "@/lib/recipes/form";
import type { SettingsListKey } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

function CheckOptions({ list, selected, onChange }: { list: SettingsListKey; selected: string[]; onChange: (values: string[]) => void }) {
  const { data, t } = useApp();
  const items = data.settings[list] || [];
  if (!items.length) return <p className="field-hint">{t("Aggiungi voci dalle impostazioni.")}</p>;
  return (
    <div className="checklist-options">
      {items.map((item) => (
        <label key={item} className="check-option">
          <input type="checkbox" checked={selected.includes(item)} onChange={(event) => onChange(event.target.checked ? [...selected, item] : selected.filter((value) => value !== item))} />
          <span>{t(item)}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * Allergens of the dish: what the ingredients bring (and from which ones), what it may contain as
 * traces, and the kitchen's confirmation. A confirmation that no longer matches asks for a new check.
 */
function AllergenSection({ form, patch }: { form: RecipeForm; patch: FormPatch }) {
  const { data, t, fmt, f } = useApp();
  // The dish as it would be saved, with the stock values of linked rows.
  const recipe = resolveRecipe(fromForm(form, data.recipes.find((item) => item.id === form.id)), data.stockItems, data.recipes);
  const saved = data.recipes.find((item) => item.id === form.id);
  const status = allergenStatus({ ...recipe, allergenCheck: form.allergensConfirmed && !form.allergensTouched ? saved?.allergenCheck : undefined }, data.stockItems, data.recipes);
  const sources = allergenSources(recipe);
  const changed = form.allergensConfirmed && !form.allergensTouched && status.state === "changed";

  return (
    <div className="form-section">
      <h3 className="form-section-title">{t("Allergeni del piatto")} <small>{t("dagli ingredienti e dalle basi")}</small></h3>
      {sources.length ? (
        <ul className="allergen-sources">
          {sources.map((row) => <li key={row.allergen}><span className="allergen-tag">{t(row.allergen)}</span><small>{row.ingredients.join(", ")}</small></li>)}
        </ul>
      ) : <p className="field-hint">{recipe.ingredients.length ? t("Nessun allergene negli ingredienti.") : t("Aggiungi gli ingredienti: gli allergeni arrivano da loro.")}</p>}
      {status.notInStock.length ? (
        <p className="allergen-warning">{fmt(t("Allergeni scritti a mano, non dal magazzino: {0}. Controllali o aggiungi i prodotti al magazzino."), status.notInStock.join(", "))}</p>
      ) : null}
      <FieldShell label={t("Può contenere (tracce)")} htmlFor="field-mayContain" hint={t("Contaminazione crociata: friggitrice in comune, stesse superfici, prodotti con \"può contenere\" in etichetta.")} wide>
        <AllergenPicker value={form.mayContain} onChange={(mayContain) => patch({ mayContain })} />
      </FieldShell>
      <div className={"allergen-confirm" + (changed ? " changed" : form.allergensConfirmed ? " ok" : "")}>
        {changed ? (
          <p>{t("Gli allergeni sono cambiati dall'ultimo controllo")}{status.added.length ? " · " + fmt(t("aggiunti: {0}"), status.added.map(t).join(", ")) : ""}{status.removed.length ? " · " + fmt(t("tolti: {0}"), status.removed.map(t).join(", ")) : ""}. {t("Ricontrolla e conferma di nuovo.")}</p>
        ) : null}
        <CheckPill id="field-allergensConfirmed" checked={form.allergensConfirmed && !changed} onChange={(checked) => patch({ allergensConfirmed: checked, allergensTouched: true })}>
          {t("Ho controllato gli allergeni di questo piatto")}
        </CheckPill>
        <TextField label={t("Controllato da")} name="allergensCheckedBy" value={form.allergensCheckedBy} onChange={(allergensCheckedBy) => patch({ allergensCheckedBy })} placeholder={t("Nome")} />
        {status.check && !form.allergensTouched && !changed ? <small className="field-hint">{fmt(t("Confermato il {0}"), f.dateLabel(status.check.at))}{status.check.by ? " · " + status.check.by : ""}</small> : null}
      </div>
    </div>
  );
}

export function KitchenPanel({ form, patch }: { form: RecipeForm; patch: FormPatch }) {
  const { data, t } = useApp();
  const area = (label: string, name: keyof RecipeForm, placeholder: string, wide = false) => (
    <TextAreaField label={t(label)} name={name} value={String(form[name] ?? "")} onChange={(value) => patch({ [name]: value })} placeholder={t(placeholder)} wide={wide} />
  );
  return (
    <section className="editor-panel active">
      <div className="form-section">
        <h3 className="form-section-title">{t("Preparazione e servizio")}</h3>
        <div className="form-grid">
          {area("MEP / preparazione anticipata", "mep", "Cosa preparare prima del servizio…")}
          {area("Metodo", "method", "Descrivi i passaggi…", true)}
          {area("Impiattamento e servizio", "plating", "Finitura e servizio…")}
          {area("Informazioni nutrizionali", "nutritionInfo", "Note nutrizionali…")}
          {area("Indicazioni sugli allergeni", "allergenGuidance", "Gestione allergeni e contaminazione crociata…", true)}
          <TextField label={t("Conservazione (giorni)")} name="shelfLifeDays" type="number" step="1" value={form.shelfLifeDays} onChange={(shelfLifeDays) => patch({ shelfLifeDays })}
            placeholder={String(data.settings.foodSafety.defaultShelfLifeDays)} hint={t("Per la data di scadenza sulle etichette della prep list.")} />
        </div>
      </div>
      <AllergenSection form={form} patch={patch} />
      <div className="form-section">
        <h3 className="form-section-title">{t("Controlli di sicurezza")} <small>{t("personalizzabili")}</small></h3>
        <CheckOptions list="ccpChecks" selected={form.ccpChecks} onChange={(ccpChecks) => patch({ ccpChecks })} />
      </div>
      <div className="form-section">
        <h3 className="form-section-title">{t("Preparazione e attrezzature")}</h3>
        <CheckOptions list="prepChecks" selected={form.prepChecks} onChange={(prepChecks) => patch({ prepChecks })} />
      </div>
    </section>
  );
}
