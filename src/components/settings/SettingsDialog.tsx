"use client";

import { useState } from "react";
import { GeneralPane } from "@/components/settings/GeneralPane";
import { GpPane } from "@/components/settings/GpPane";
import { ListPane } from "@/components/settings/ListPane";
import { StaffPane } from "@/components/settings/StaffPane";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { clone } from "@/lib/num";
import type { Settings, SettingsListKey } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSettingsActions } from "@/state/actions/useSettingsActions";

export type SettingsPatch = (change: Partial<Settings>) => void;

const LISTS: [SettingsListKey, string, string][] = [
  ["categories", "Categorie", "Organizza il catalogo per tipo di portata, servizio o altre etichette."],
  ["cookingMethods", "Tecniche", "Tecniche disponibili nella scheda ricetta."],
  ["allergens", "Allergeni", "Voci usate nella matrice; puoi aggiungere etichette specifiche."],
  ["ccpChecks", "Controlli", "Promemoria selezionabili nelle schede ricetta."],
  ["prepChecks", "Preparazione", "Attrezzature e indicazioni per la preparazione."]
];

type Tab = "general" | "gp" | "staff" | SettingsListKey;

export function SettingsDialog({ initialTab }: { initialTab?: "general" | "gp" | "staff" }) {
  const { data, language, closeDialog, t } = useApp();
  const guard = useGuard();
  const { saveSettings } = useSettingsActions();
  const [draft, setDraft] = useState<Settings>(() => ({ ...clone(data.settings), language }));
  const [tab, setTab] = useState<Tab>(initialTab ?? "general");
  const patch: SettingsPatch = (change) => setDraft((old) => ({ ...old, ...change }));

  const tabs: [Tab, string][] = [["general", t("Generali")], ["gp", t("Calcolo GP")], ["staff", t("Personale")], ...LISTS.map(([key, title]) => [key, t(title)] as [Tab, string])];
  const list = LISTS.find(([key]) => key === tab);
  // Empty rows are dropped on save, like in a spreadsheet.
  const save = () => saveSettings({
    ...draft, ...Object.fromEntries(LISTS.map(([key]) => [key, draft[key].map((item) => item.trim()).filter(Boolean)])),
    staff: draft.staff.map((member) => ({ ...member, name: member.name.trim() })).filter((member) => member.name)
  });

  return (
    <Dialog>
      <DialogHeader kicker={t("IL TUO SPAZIO")} title={t("Impostazioni")} subtitle={t("Valuta, lingua, calcolo GP, personale e liste della tua cucina.")} />
      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.map(([key, title]) => <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{title}</button>)}
        </nav>
        <div>
          {tab === "general" ? <GeneralPane draft={draft} patch={patch} /> : null}
          {tab === "gp" ? <GpPane draft={draft} patch={patch} /> : null}
          {tab === "staff" ? <StaffPane draft={draft} patch={patch} /> : null}
          {list ? <ListPane key={list[0]} title={t(list[1])} description={t(list[2])} items={draft[list[0]]} onChange={(items) => patch({ [list[0]]: items })} /> : null}
          <div className="settings-note" style={{ margin: "0 18px 18px" }}>{t("Le modifiche vengono salvate nel tuo archivio e si riflettono nelle nuove schede.")}</div>
        </div>
      </div>
      <footer className="dialog-footer">
        <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
        <button className="button button-primary" type="button" onClick={guard(save)}>{t("Salva impostazioni")}</button>
      </footer>
    </Dialog>
  );
}
