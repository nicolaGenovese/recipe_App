"use client";

import { useState } from "react";
import { AccountCard, NewAccountFields, SignInForm, accountReady, send, useSubmit, useWords } from "@/app/login/AccountForms";
import type { InviteInfo, SessionUser } from "@/lib/server/directory";

export function InviteView({ token, info, user }: { token: string; info: InviteInfo | null; user: SessionUser | null }) {
  const t = useWords();
  const [mode, setMode] = useState<"new" | "signin">("new");
  const [account, setAccount] = useState({ name: "", email: info?.email ?? "", password: "" });
  const accept = async () => { await send("/api/invites/" + encodeURIComponent(token), {}); window.location.assign("/"); };
  const signUp = useSubmit(async () => {
    await send("/api/auth/sign-up/email", { name: account.name.trim(), email: account.email.trim(), password: account.password });
    await accept();
  });
  const acceptNow = useSubmit(accept);

  if (!info || info.expired || info.accepted) {
    return (
      <AccountCard title={t("Invito non valido")} intro={t(info?.accepted ? "Questo invito è già stato usato." : "L'invito non esiste o è scaduto: chiedine uno nuovo a chi te l'ha mandato.")}>
        <p className="account-links"><a href="/login">{t("Vai all'accesso")}</a></p>
      </AccountCard>
    );
  }
  const intro = <>{t("Sei invitato in")} <strong>{info.companyName}</strong> {t("come")} <strong>{t(info.roleName)}</strong>{info.placeName && info.placeName !== info.companyName ? <> · {info.placeName}</> : null}.</>;
  if (user) {
    return (
      <AccountCard title={t("Invito")} intro={intro}>
        <p>{t("Hai già un account:")} {user.name} ({user.email}).</p>
        <form className="account-form" onSubmit={acceptNow.onSubmit}>
          {acceptNow.error ? <p className="login-error" role="alert">{acceptNow.error}</p> : null}
          <button className="button button-primary" type="submit" disabled={acceptNow.busy}>{t("Accetta l'invito")}</button>
        </form>
      </AccountCard>
    );
  }
  return (
    <AccountCard title={t("Invito")} intro={intro}>
      <div className="kitchen-segment account-tabs" role="group">
        <button type="button" className={mode === "new" ? "active" : ""} aria-pressed={mode === "new"} onClick={() => setMode("new")}>{t("Nuovo account")}</button>
        <button type="button" className={mode === "signin" ? "active" : ""} aria-pressed={mode === "signin"} onClick={() => setMode("signin")}>{t("Ho già un account")}</button>
      </div>
      {mode === "new" ? (
        <form className="account-form" onSubmit={signUp.onSubmit}>
          <NewAccountFields value={account} onChange={setAccount} />
          {signUp.error ? <p className="login-error" role="alert">{signUp.error}</p> : null}
          <button className="button button-primary" type="submit" disabled={signUp.busy || !accountReady(account)}>{t("Crea l'account e accetta")}</button>
        </form>
      ) : <SignInForm onDone={accept} autoFocus={false} />}
    </AccountCard>
  );
}
