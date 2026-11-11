"use client";

import type { SettingsPatch } from "@/components/settings/SettingsDialog";
import { CURRENCIES, currencyCode, currencySymbol } from "@/lib/format";
import { LANGUAGES } from "@/lib/i18n";
import type { Language, Settings } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

export function GeneralPane({ draft, patch }: { draft: Settings; patch: SettingsPatch }) {
  const { f, t } = useApp();
  return (
    <section className="settings-pane active">
      <h3>{t("Generali")}</h3>
      <p>{t("Valuta e lingua usate in tutta l'app.")}</p>
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
          <select id="settingsLanguage" value={draft.language ?? "it"} onChange={(event) => patch({ language: event.target.value as Language })}>
            {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
      </div>
    </section>
  );
}
