"use client";

import { useState } from "react";
import { CompanySettings, type CompanySection } from "@/components/company/CompanySettings";
import { GeneralPane } from "@/components/settings/GeneralPane";
import { GpPane } from "@/components/settings/GpPane";
import { ListPane } from "@/components/settings/ListPane";
import { StaffPane } from "@/components/settings/StaffPane";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { clone } from "@/lib/num";
import type { Settings, SettingsListKey } from "@/lib/types";
import type { SettingsTab } from "@/state/dialogs";
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

type Tab = SettingsTab;
const COMPANY: CompanySection[] = ["people", "sites", "roles", "audit"];
const isCompany = (tab: Tab): tab is CompanySection => (COMPANY as string[]).includes(tab);

/**
 * Settings in two groups: the kitchen (currency, language, GP, staff, lists) for whoever may change
 * the company settings, and the company (people, sites and areas, roles and permissions, activity
 * log), each shown only to the roles that can use it. Company sections save at once.
 */
export function SettingsDialog({ initialTab }: { initialTab?: SettingsTab }) {
  const { data, language, closeDialog, t, access, can } = useApp();
  const guard = useGuard();
  const { saveSettings } = useSettingsActions();
  const [draft, setDraft] = useState<Settings>(() => ({ ...clone(data.settings), language }));
  const kitchen = can("settings.company");
  const company: [CompanySection, string][] = access ? ([
    ["people", t("Persone"), can("users.manage")],
    ["sites", t("Sedi e aree"), can("users.manage") || can("company.manage")],
    ["roles", t("Ruoli e permessi"), can("users.manage") || can("company.manage")],
    ["audit", t("Registro attività"), can("audit.view")]
  ] as [CompanySection, string, boolean][]).filter((row) => row[2]).map(([key, label]) => [key, label]) : [];
  const [tab, setTab] = useState<Tab>(() => initialTab ?? (kitchen ? "general" : company[0]?.[0] ?? "general"));
  const patch: SettingsPatch = (change) => setDraft((old) => ({ ...old, ...change }));

  const tabs: [Tab, string][] = kitchen ? [["general", t("Generali")], ["gp", t("Calcolo GP")], ["staff", t("Personale")], ...LISTS.map(([key, title]) => [key, t(title)] as [Tab, string])] : [];
  const onCompany = isCompany(tab);
  const list = LISTS.find(([key]) => key === tab);
  // Empty rows are dropped on save, like in a spreadsheet.
  const save = () => saveSettings({
    ...draft, ...Object.fromEntries(LISTS.map(([key]) => [key, draft[key].map((item) => item.trim()).filter(Boolean)])),
    staff: draft.staff.map((member) => ({ ...member, name: member.name.trim() })).filter((member) => member.name)
  });

  return (
    <Dialog size={onCompany ? "wide" : "normal"}>
      <DialogHeader kicker={access ? access.company.name.toUpperCase() : t("IL TUO SPAZIO")} title={t("Impostazioni")}
        subtitle={t(access ? "La cucina (valuta, lingua, GP, personale, liste) e la compagnia (persone, sedi, ruoli e permessi)." : "Valuta, lingua, calcolo GP, personale e liste della tua cucina.")} />
      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.length && company.length ? <span className="settings-nav-group">{t("Cucina")}</span> : null}
          {tabs.map(([key, title]) => <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{title}</button>)}
          {company.length ? <span className="settings-nav-group">{t("Compagnia")}</span> : null}
          {company.map(([key, title]) => <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{title}</button>)}
        </nav>
        <div className="settings-body">
          {onCompany ? <section className="settings-pane active settings-company"><CompanySettings key={tab} section={tab} /></section> : (
            <>
              {tab === "general" ? <GeneralPane draft={draft} patch={patch} /> : null}
              {tab === "gp" ? <GpPane draft={draft} patch={patch} /> : null}
              {tab === "staff" ? <StaffPane draft={draft} patch={patch} /> : null}
              {list ? <ListPane key={list[0]} title={t(list[1])} description={t(list[2])} items={draft[list[0]]} onChange={(items) => patch({ [list[0]]: items })} /> : null}
              <div className="settings-note" style={{ margin: "0 18px 18px" }}>{t("Le modifiche vengono salvate nel tuo archivio e si riflettono nelle nuove schede.")}</div>
            </>
          )}
        </div>
      </div>
      <footer className="dialog-footer">
        {onCompany ? (
          <>
            <span className="settings-footnote">{t("Le modifiche della compagnia si salvano subito.")}</span>
            <button className="button button-primary" type="button" onClick={closeDialog}>{t("Chiudi")}</button>
          </>
        ) : (
          <>
            <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
            <button className="button button-primary" type="button" onClick={guard(save)}>{t("Salva impostazioni")}</button>
          </>
        )}
      </footer>
    </Dialog>
  );
}
