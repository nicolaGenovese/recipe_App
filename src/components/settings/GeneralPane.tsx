"use client";

import type { SettingsPatch } from "@/components/settings/SettingsDialog";
import { CURRENCIES, currencyCode, currencySymbol } from "@/lib/format";
import { LANGUAGES } from "@/lib/i18n";
import { UNIT_CATALOG } from "@/lib/stock/units";
import type { Language, Settings } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

export function GeneralPane({ draft, patch }: { draft: Settings; patch: SettingsPatch }) {
  const { f, t } = useApp();
  return (
    <section className="settings-pane active">
      <h3>{t("Generali")}</h3>
      <p>{t("Valuta, lingua e unità di misura usate in tutta l'app.")}</p>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="settingsCurrency">{t("Valuta")}</label>
          <select id="settingsCurrency" value={currencyCode(draft.currency)} onChange={(event) => patch({ currency: event.target.value })}>
            {CURRENCIES.map((code) => <option key={code} value={code}>{code} · {currencySymbol(f.locale, code)}</option>)}
          </select>
          <small className="field-hint">{t("Cambia solo il simbolo mostrato: gli importi salvati non vengono convertiti.")}</small>
        </div>
        <div className="form-field">
          <label htmlFor="settingsLanguage">{t("Lingua")}</label>
          <select id="settingsLanguage" value={draft.language ?? "en"} onChange={(event) => patch({ language: event.target.value as Language })}>
            {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
      </div>
      <div className="settings-units">
        <span className="field-label">{t("Unità di misura")}</span>
        <small className="field-hint">{t("Le unità spuntate compaiono nei menu di ingredienti e prodotti. Le conversioni (per esempio g ↔ kg, oz ↔ g) restano automatiche.")}</small>
        {(["metric", "imperial", "count"] as const).map((group) => (
          <div key={group} className="settings-unit-group">
            <strong>{t(group === "metric" ? "Sistema metrico" : group === "imperial" ? "Sistema imperiale (UK)" : "A pezzi e a misura")}</strong>
            <div className="form-checks">
              {UNIT_CATALOG.filter((unit) => unit.group === group).map((unit) => {
                const on = draft.units.includes(unit.key);
                return (
                  <label key={unit.key} className={"form-check" + (on ? " checked" : "")}>
                    <input type="checkbox" checked={on}
                      onChange={(event) => patch({ units: event.target.checked ? [...draft.units, unit.key] : draft.units.filter((key) => key !== unit.key) })} />
                    {t(unit.label)}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {draft.units.length ? null : <small className="field-hint settings-warn">{t("Scegli almeno un'unità.")}</small>}
      </div>
    </section>
  );
}
