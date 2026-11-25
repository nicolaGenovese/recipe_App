"use client";

import { useState } from "react";
import { AccountCard, Field, NewAccountFields, accountReady, send, useSubmit, useWords } from "@/app/login/AccountForms";

/** Sign up: a new account with its company and first site; the person becomes the owner. */
export default function RegisterPage() {
  const t = useWords();
  const [account, setAccount] = useState({ name: "", email: "", password: "" });
  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const { busy, error, onSubmit } = useSubmit(async () => {
    await send("/api/account", { action: "register", ...account, companyName: company, siteName: site });
    window.location.assign("/");
  });
  return (
    <AccountCard title={t("Crea la tua compagnia")} intro={t("Un account per te, la compagnia e la prima sede. Altre sedi e il personale si aggiungono dopo.")}>
      <form className="account-form" onSubmit={onSubmit}>
        <NewAccountFields value={account} onChange={setAccount} />
        <Field id="registerCompany" label={t("Nome della compagnia")} value={company} onChange={setCompany} hint={t("Es. Rossi Ristorazione. Si può cambiare dopo.")} />
        <Field id="registerSite" label={t("Nome della sede")} value={site} onChange={setSite} hint={t("Es. Trattoria del Porto.")} />
        {error ? <p className="login-error" role="alert">{error}</p> : null}
        <button className="button button-primary" type="submit" disabled={busy || !accountReady(account) || !company.trim()}>{t(busy ? "Creazione…" : "Crea la compagnia")}</button>
      </form>
      <p className="account-links"><a href="/login">{t("Ho già un account: accedi")}</a></p>
    </AccountCard>
  );
}
