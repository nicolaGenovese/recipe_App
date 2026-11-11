"use client";

import { makeTranslate } from "@/lib/i18n";
import type { Settings } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

export function useSettingsActions() {
  const { update, setLanguage, refreshHealth, closeDialog, notify, t } = useApp();

  async function persistSettings(settings: Settings): Promise<Settings> {
    const saved = await api.saveSettings(settings);
    update((data) => ({ ...data, settings: saved }));
    if (saved.language) setLanguage(saved.language);
    return saved;
  }

  async function saveSettings(settings: Settings) {
    await persistSettings(settings);
    closeDialog();
    void refreshHealth();
    // The toast is written in the language just chosen, not the one the dialog opened in.
    notify((settings.language ? makeTranslate(settings.language) : t)("Impostazioni salvate."));
  }

  return { persistSettings, saveSettings };
}
