"use client";

import { useState } from "react";
import { BrandIcon } from "@/components/ui/icons";
import { makeTranslate, readStoredLanguage } from "@/lib/i18n";

/** The shared-password page shown before the app. */
export function LoginForm({ target, configured }: { target: string; configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const t = makeTranslate(typeof window === "undefined" ? "en" : readStoredLanguage());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      if (response.ok) { window.location.assign(target); return; }
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(t(payload.error || "Accesso non riuscito."));
    } catch {
      setError(t("Accesso non riuscito."));
    }
    setBusy(false);
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark" aria-hidden="true"><BrandIcon /></span>
        <h1>Recipe Studio</h1>
        <p>{t(configured ? "Inserisci la password della cucina per entrare." : "La password non è ancora configurata: imposta APP_PASSWORD nelle variabili d'ambiente.")}</p>
        <label htmlFor="loginPassword">{t("Password")}</label>
        <input id="loginPassword" type="password" autoComplete="current-password" value={password} autoFocus disabled={!configured} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="login-error" role="alert">{error}</p> : null}
        <button className="button button-primary" type="submit" disabled={!configured || busy || !password}>{t(busy ? "Accesso…" : "Entra")}</button>
      </form>
    </main>
  );
}
