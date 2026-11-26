"use client";

import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BrandIcon } from "@/components/ui/icons";
import { LANGUAGE_STORAGE_KEY, makeTranslate, readStoredLanguage, storeLanguage } from "@/lib/i18n";
import type { Language } from "@/lib/types";

const WordsContext = createContext<Language | null>(null);

/**
 * The language chosen on the server for an account page, so the page the server sends and the one the
 * browser draws are the same. A choice saved only in this browser (from before the cookie) wins after
 * the first paint, and is copied to the cookie for next time.
 */
export function LanguageScope({ language, children }: { language: Language; children: ReactNode }) {
  const [current, setCurrent] = useState(language);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* Private mode. */ }
    if ((saved === "it" || saved === "en") && saved !== language) { storeLanguage(saved); setCurrent(saved); }
  }, [language]);
  return <WordsContext.Provider value={current}><div lang={current}>{children}</div></WordsContext.Provider>;
}

/** The app's words in the page's language; account pages have no archive yet to take it from. */
export function useWords() {
  const scoped = useContext(WordsContext);
  return makeTranslate(scoped ?? (typeof window === "undefined" ? "en" : readStoredLanguage()));
}

/** Sends JSON and returns the parsed answer, or throws the server's message. */
export async function send<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string; code?: string };
  if (!response.ok) throw new Error(payload.error || (payload.code === "INVALID_EMAIL_OR_PASSWORD" ? "Email o password errate." : payload.message) || "Operazione non riuscita.");
  return payload as T;
}

/** The account card, on a page of its own or, `embedded`, inside the landing page. */
export function AccountCard({ title, intro, children, embedded = false }: { title: string; intro?: ReactNode; children: ReactNode; embedded?: boolean }) {
  const card = (
    <div className={"login-card account-card" + (embedded ? " embedded" : "")}>
      {embedded ? null : <span className="brand-mark" aria-hidden="true"><BrandIcon /></span>}
      {embedded ? <h2>{title}</h2> : <h1>{title}</h1>}
      {intro ? <p>{intro}</p> : null}
      {children}
    </div>
  );
  return embedded ? card : <main className="login-page">{card}</main>;
}

export function Field({ id, label, type = "text", value, onChange, autoComplete, autoFocus, hint }: {
  id: string; label: string; type?: string; value: string; onChange: (value: string) => void; autoComplete?: string; autoFocus?: boolean; hint?: string;
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} autoComplete={autoComplete} autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small className="account-hint">{hint}</small> : null}
    </>
  );
}

/** A form that runs `submit`, shows its error and disables itself while busy. */
export function useSubmit(submit: () => Promise<void>) {
  const t = useWords();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await submit(); }
    catch (failure) { setError(t(failure instanceof Error ? failure.message : "Operazione non riuscita.")); setBusy(false); }
  };
  return { busy, error, onSubmit };
}

/** Email and password sign in through Better Auth. */
export function SignInForm({ target, onDone, autoFocus = true }: { target?: string; onDone?: () => Promise<void>; autoFocus?: boolean }) {
  const t = useWords();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, onSubmit } = useSubmit(async () => {
    await send("/api/auth/sign-in/email", { email: email.trim(), password, rememberMe: true });
    if (onDone) await onDone();
    else window.location.assign(target || "/");
  });
  return (
    <form className="account-form" onSubmit={onSubmit}>
      <Field id="signInEmail" label={t("Email")} type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus={autoFocus} />
      <Field id="signInPassword" label={t("Password")} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      {error ? <p className="login-error" role="alert">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={busy || !email.trim() || !password}>{t(busy ? "Accesso…" : "Entra")}</button>
    </form>
  );
}

/** Name, email and password of a new account, shared by sign up, first access and invites. */
export function NewAccountFields({ value, onChange }: { value: { name: string; email: string; password: string }; onChange: (value: { name: string; email: string; password: string }) => void }) {
  const t = useWords();
  return (
    <>
      <Field id="accountName" label={t("Il tuo nome")} value={value.name} onChange={(name) => onChange({ ...value, name })} autoComplete="name" />
      <Field id="accountEmail" label={t("Email")} type="email" value={value.email} onChange={(email) => onChange({ ...value, email })} autoComplete="email" />
      <Field id="accountPassword" label={t("Password")} type="password" value={value.password} onChange={(password) => onChange({ ...value, password })} autoComplete="new-password" hint={t("Almeno 8 caratteri.")} />
    </>
  );
}

export const accountReady = (value: { name: string; email: string; password: string }) => Boolean(value.name.trim() && value.email.trim() && value.password.length >= 8);
