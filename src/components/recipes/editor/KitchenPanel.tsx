"use client";

import type { FormPatch } from "@/components/recipes/editor/RecipeEditorDialog";
import { AllergenTags } from "@/components/ui/bits";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { ingredientFromDraft, type RecipeForm } from "@/lib/recipes/form";
import { allergens } from "@/lib/recipes/math";
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
      <div className="form-section">
        <h3 className="form-section-title">{t("Allergeni dagli ingredienti")} <small>{t("modificabili nelle righe ingrediente")}</small></h3>
        <AllergenTags items={allergens({ ingredients: form.ingredients.map(ingredientFromDraft) })} empty={t("Aggiungili alle righe ingrediente.")} />
      </div>
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
