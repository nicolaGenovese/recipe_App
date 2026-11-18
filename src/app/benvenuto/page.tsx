"use client";

import { useState } from "react";
import { AccountCard, Field, send, useSubmit, useWords } from "@/app/login/AccountForms";

/** A signed-in account that belongs to no company yet: create one, or open the invite link received. */
export default function WelcomePage() {
  const t = useWords();
  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const { busy, error, onSubmit } = useSubmit(async () => {
    await send("/api/account", { action: "company", companyName: company, siteName: site });
    window.location.assign("/");
  });
  const logout = async () => { await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); window.location.assign("/login"); };
  return (
    <AccountCard title={t("Benvenuto")} intro={t("Il tuo account non fa ancora parte di nessuna compagnia. Se ti hanno invitato, apri il link d'invito ricevuto; altrimenti crea la tua compagnia.")}>
      <form className="account-form" onSubmit={onSubmit}>
        <Field id="welcomeCompany" label={t("Nome della compagnia")} value={company} onChange={setCompany} />
        <Field id="welcomeSite" label={t("Nome della sede")} value={site} onChange={setSite} />
        {error ? <p className="login-error" role="alert">{error}</p> : null}
        <button className="button button-primary" type="submit" disabled={busy || !company.trim()}>{t("Crea la compagnia")}</button>
      </form>
      <button type="button" className="link-button account-switch" onClick={() => void logout()}>{t("Esci")}</button>
    </AccountCard>
  );
}
