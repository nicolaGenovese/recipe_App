"use client";

import type { SettingsPatch } from "@/components/settings/SettingsDialog";
import { Callout } from "@/components/ui/bits";
import { clamp, num } from "@/lib/num";
import type { GpRules, Settings } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

type NumberRule = "target" | "salesVatRate" | "defaultVat" | "defaultMarginTarget";
type FlagRule = "salesIncludeVat" | "includeTransfers" | "recipeMarginOnNet";

export function GpPane({ draft, patch }: { draft: Settings; patch: SettingsPatch }) {
  const { t } = useApp();
  const rules = draft.gp;
  const set = (change: Partial<GpRules>) => patch({ gp: { ...rules, ...change } });

  const numberField = (key: NumberRule, label: string, hint: string, max = 100) => (
    <div className="form-field">
      <label htmlFor={"gp-" + key}>{t(label)}</label>
      <input id={"gp-" + key} type="number" min="0" max={max} step="0.1" value={num(rules[key])} onChange={(event) => set({ [key]: clamp(num(event.target.value), 0, max) })} />
      <small className="field-hint">{t(hint)}</small>
    </div>
  );
  const flag = (key: FlagRule, label: string, hint: string) => (
    <label className={"form-check settings-check" + (rules[key] ? " checked" : "")}>
      <input type="checkbox" checked={rules[key]} onChange={(event) => set({ [key]: event.target.checked })} />
      <span><strong>{t(label)}</strong><small>{t(hint)}</small></span>
    </label>
  );

  return (
    <section className="settings-pane active">
      <h3>{t("Calcolo GP")}</h3>
      <p>{t("Regole usate nei report Food Stock e nel margine delle ricette.")}</p>
      <h4 className="settings-subtitle">{t("Report Food Stock")}</h4>
      <div className="form-grid">
        {numberField("target", "GP obiettivo (%)", "Il GP del report è verde se raggiunge l'obiettivo, rosso se è sotto. 0 = nessun obiettivo.")}
        {numberField("salesVatRate", "IVA sulle vendite (%)", "Usata solo se le vendite sono inserite IVA inclusa.")}
      </div>
      {flag("salesIncludeVat", "Vendite inserite IVA inclusa", "Il GP usa le vendite al netto dell'IVA.")}
      {flag("includeTransfers", "Includi i trasferimenti nel costo del venduto", "Se disattivato, i trasferimenti restano nel report ma non cambiano il GP.")}
      <h4 className="settings-subtitle">{t("Ricette")}</h4>
      {flag("recipeMarginOnNet", "Margine sul prezzo al netto dell'IVA", "Se disattivato, il margine teorico usa il prezzo di vendita così com'è.")}
      <div className="form-grid">
        {numberField("defaultVat", "IVA predefinita (%)", "Per le nuove ricette.")}
        {numberField("defaultMarginTarget", "Margine obiettivo predefinito (%)", "Per le nuove ricette.", 95)}
      </div>
      <Callout title={t("Report già inviati")}>{t("Mantengono le regole con cui sono stati inviati.")}</Callout>
    </section>
  );
}
