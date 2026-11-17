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

/**
 * Italian text is the key; English falls back to Italian when a key is missing. A key may end in
 * "|context" when the same Italian word needs two English ones ("Altro|nav" → "More", "Altro" → "Other");
 * the context never shows.
 */
export function makeTranslate(language: Language): Translate {
  return (source) => {
    if (typeof source !== "string") return source;
    const plain = source.includes("|") ? source.slice(0, source.indexOf("|")) : source;
    if (language !== "en") return plain;
    return Object.hasOwn(EN, source) ? EN[source] : Object.hasOwn(EN, plain) ? EN[plain] : plain;
  };
}

/** "1 porzione", "4 porzioni": picks the word for the count, then translates it. */
export const countLabel = (t: Translate, count: number, one: string, many: string) => count + " " + t(count === 1 ? one : many);

export function readStoredLanguage(): Language {
  // English unless this browser chose Italian.
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "it" ? "it" : "en"; } catch { return "en"; }
}
export function storeLanguage(language: Language): void {
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Private mode: the archive still keeps it. */ }
}
