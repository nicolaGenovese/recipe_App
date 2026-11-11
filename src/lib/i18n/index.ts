import { EN } from "@/lib/i18n/en";
import type { Language } from "@/lib/types";

export const LANGUAGES: [Language, string][] = [["it", "Italiano"], ["en", "English"]];
export const LANGUAGE_STORAGE_KEY = "recipe-studio-language";

export type Translate = (source: string) => string;

/** Fills {0}, {1}… placeholders in a translated string. */
export function fmt(source: string, ...values: unknown[]): string {
  return source.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ""));
}

export function localeFor(language: Language): string {
  return language === "en" ? "en-GB" : "it-IT";
}

/** Italian text is the key; English falls back to Italian when a key is missing. */
export function makeTranslate(language: Language): Translate {
  return (source) => {
    if (language !== "en" || typeof source !== "string") return source;
    return Object.hasOwn(EN, source) ? EN[source] : source;
  };
}

export function readStoredLanguage(): Language {
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "it"; } catch { return "it"; }
}
export function storeLanguage(language: Language): void {
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Private mode: the archive still keeps it. */ }
}
