"use client";

import { useState } from "react";
import type { FormPatch } from "@/components/recipes/editor/RecipeEditorDialog";
import { CheckPill, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { PlateIcon } from "@/components/ui/icons";
import { sortMenus } from "@/lib/menus/menus";
import { useGuard } from "@/state/actions/useGuard";
import { useMenuActions } from "@/state/actions/useMenuActions";
import type { RecipeForm } from "@/lib/recipes/form";
import { useApp } from "@/state/AppProvider";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

export function GeneralPanel({ form, patch }: { form: RecipeForm; patch: FormPatch }) {
  const { data, t, notify } = useApp();
  const guard = useGuard();
  const { createMenu } = useMenuActions();
  const [adding, setAdding] = useState(false);
  const [newMenu, setNewMenu] = useState("");

  /** The new menu is saved at once and ticked for this recipe; the dish joins it when the recipe is saved. */
  const addMenu = guard(async () => {
    const menu = await createMenu(newMenu);
    if (!menu) return;
    patch((old) => ({ menuIds: old.menuIds.includes(menu.id) ? old.menuIds : [...old.menuIds, menu.id] }));
    setAdding(false);
    setNewMenu("");
  });
  const options = (values: string[]) => values.map((value) => ({ value, label: t(value) }));
  const categories = Array.from(new Set(data.settings.categories.concat(form.category || [])));
  const methods = Array.from(new Set(data.settings.cookingMethods.concat(form.cookingMethod || [])));

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { notify(t("Scegli un'immagine JPG, PNG o WebP."), true); return; }
    if (file.size > MAX_IMAGE_BYTES) { notify(t("L'immagine supera il limite di 1,5 MB."), true); return; }
    // Images are stored inside the recipe as a data URL, so no file storage is needed.
    const reader = new FileReader();
    reader.onload = () => patch({ image: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  return (
    <section className="editor-panel active">
      <div className="form-section">
        <h3 className="form-section-title">{t("Informazioni di base")} <small>{t("* Campi richiesti")}</small></h3>
        <div className="form-grid">
          <TextField label={t("Nome della ricetta *")} name="name" value={form.name} onChange={(name) => patch({ name })} required placeholder={t("Es. Pasta al limone e basilico")} wide />
          <SelectField label={t("Categoria")} name="category" value={form.category} onChange={(category) => patch({ category })} options={options(categories)} />
          <TextField label={t("Porzioni / resa")} name="portions" type="number" min={1} step="1" value={form.portions} onChange={(portions) => patch({ portions })} />
          <TextField label={t("Autore o responsabile")} name="creator" value={form.creator} onChange={(creator) => patch({ creator })} />
          <SelectField label={t("Tecnica di cottura")} name="cookingMethod" value={form.cookingMethod} onChange={(cookingMethod) => patch({ cookingMethod })} options={options(methods)} />
          <TextAreaField label={t("Descrizione breve")} name="description" value={form.description} onChange={(description) => patch({ description })} wide placeholder={t("Un appunto per riconoscere il piatto…")} />
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-field">
            <span className="field-label">{t("Visibilità")}</span>
            <div className="form-checks">
              <CheckPill checked={form.archivedBatch} onChange={(archivedBatch) => patch({ archivedBatch })}>{t("Base / preparazione")}</CheckPill>
            </div>
            <span className="field-label" style={{ marginTop: 10 }}>{t("Nei menu")}</span>
            <div className="form-checks">
              {sortMenus(data.menus).map((menu) => (
                <CheckPill key={menu.id} checked={form.menuIds.includes(menu.id)}
                  onChange={(on) => patch((old) => ({ menuIds: on ? [...old.menuIds, menu.id] : old.menuIds.filter((id) => id !== menu.id) }))}>
                  {menu.name}{menu.active ? "" : " · " + t("sospeso")}
                </CheckPill>
              ))}
              {adding ? (
                <span className="menu-quick-add">
                  <input autoFocus value={newMenu} placeholder={t("Nome del nuovo menu")} aria-label={t("Nome del nuovo menu")}
                    onChange={(event) => setNewMenu(event.target.value)}
                    onKeyDown={(event) => {
                      // Enter must create the menu, not submit the whole recipe.
                      if (event.key === "Enter") { event.preventDefault(); void addMenu(); }
                      if (event.key === "Escape") { event.preventDefault(); setAdding(false); setNewMenu(""); }
                    }} />
                  <button type="button" className="button button-primary button-small" disabled={!newMenu.trim()} onClick={addMenu}>{t("Crea")}</button>
                  <button type="button" className="button button-quiet button-small" onClick={() => { setAdding(false); setNewMenu(""); }}>{t("Annulla")}</button>
                </span>
              ) : (
                <button type="button" className="menu-quick-new" onClick={() => setAdding(true)}>{t("+ Nuovo menu")}</button>
              )}
            </div>
            {data.menus.length || adding ? null : <small className="field-hint">{t("Nessun menu ancora: crealo qui e la ricetta ci viene aggiunta.")}</small>}
          </div>
          <div className="form-field">
            <span className="field-label">{t("Immagine della ricetta")}</span>
            <div className="image-picker">
              <div className="image-preview">{form.image ? <img src={form.image} alt={t("Anteprima")} /> : <PlateIcon />}</div>
              <div>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => pickImage(event.target.files?.[0])} />
                <p>{t("JPG, PNG o WebP · max 1,5 MB")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
