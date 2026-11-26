"use client";

import { useState } from "react";
import { AccountCard, Field, NewAccountFields, SignInForm, accountReady, send, useSubmit, useWords } from "@/app/login/AccountForms";

/**
 * Sign in with email and password. While the data that existed before accounts has no owner, the
 * page offers the first access instead: whoever knows the old app password creates the owner account.
 */
export function AccountLogin({ target, claim, appPassword, embedded = false }: { target: string; claim: boolean; appPassword: boolean; embedded?: boolean }) {
  const t = useWords();
  const [mode, setMode] = useState<"signin" | "claim">(claim ? "claim" : "signin");
  const [account, setAccount] = useState({ name: "", email: "", password: "" });
  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const { busy, error, onSubmit } = useSubmit(async () => {
    await send("/api/account", { action: "claim", ...account, companyName: company, siteName: site, appPassword: oldPassword });
    window.location.assign("/");
  });

  if (mode === "claim") {
    return (
      <AccountCard embedded={embedded} title={t("Primo accesso")} intro={t("Ora ognuno entra con il proprio account. Crea l'account del titolare: i dati di oggi diventano la tua compagnia e la tua prima sede, e poi inviti il personale.")}>
        <form className="account-form" onSubmit={onSubmit}>
          <NewAccountFields value={account} onChange={setAccount} />
          <Field id="claimCompany" label={t("Nome della compagnia")} value={company} onChange={setCompany} hint={t("Es. Rossi Ristorazione. Si può cambiare dopo.")} />
          <Field id="claimSite" label={t("Nome della sede")} value={site} onChange={setSite} hint={t("Es. Trattoria del Porto.")} />
          {appPassword ? <Field id="claimOld" label={t("Password attuale dell'app")} type="password" value={oldPassword} onChange={setOldPassword} autoComplete="current-password" hint={t("Quella che usate oggi per entrare: dimostra che i dati sono tuoi.")} /> : null}
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button className="button button-primary" type="submit" disabled={busy || !accountReady(account) || (appPassword && !oldPassword)}>{t(busy ? "Creazione…" : "Crea l'account del titolare")}</button>
        </form>
        <button type="button" className="link-button account-switch" onClick={() => setMode("signin")}>{t("Ho già un account: accedi")}</button>
      </AccountCard>
    );
  }
  return (
    <AccountCard embedded={embedded} title={embedded ? t("Accedi") : "Recipe Studio"} intro={t("Accedi con la tua email.")}>
      {/* On the landing page the cursor does not jump into the form: visitors read first. */}
      <SignInForm target={target} autoFocus={!embedded} />
      <p className="account-links">
        <a href="/registrati">{t("Crea una nuova compagnia")}</a>
        {claim ? <button type="button" className="link-button" onClick={() => setMode("claim")}>{t("Primo accesso del titolare")}</button> : null}
      </p>
      <p className="account-note">{t("Lavori in una compagnia che usa già Recipe Studio? Chiedi al tuo responsabile un link d'invito.")}</p>
    </AccountCard>
  );
}
