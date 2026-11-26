import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { LanguageScope } from "@/app/login/AccountForms";
import { LANGUAGE_COOKIE, serverLanguage } from "@/lib/i18n";
import { LoginForm } from "@/app/login/LoginForm";
import { AccountLogin } from "@/app/login/AccountLogin";
import { Landing } from "@/app/login/Landing";
import { landingFont } from "@/app/login/fonts";
import { accessPassword } from "@/lib/server/access";
import { database } from "@/lib/server/db";
import { firstCompanyUnclaimed } from "@/lib/server/directory";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recipe Studio · Kitchen management for restaurants and pubs",
  description: "Recipe costing, allergens, food safety records, stock, rotas and till orders in one place, for one restaurant or a group of sites."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only local paths are allowed, so the login page cannot send anyone to another site.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const db = database();
  // Local mode keeps the shared password; with a database there are accounts.
  if (!db) return <LoginForm target={target} configured={Boolean(accessPassword())} />;
  let claim = false;
  try { await getStore().ready(); claim = await firstCompanyUnclaimed(db.sql); }
  catch (error) { console.error("Archivio non raggiungibile:", error instanceof Error ? error.message : error); }
  // With accounts the sign in page is also the public front of the app, for kitchens that do not use it yet.
  const language = serverLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value, (await headers()).get("accept-language"));
  return (
    <div className={landingFont.variable}>
      <LanguageScope language={language}>
        <Landing signIn={<AccountLogin target={target} claim={claim} appPassword={Boolean(accessPassword())} embedded />} />
      </LanguageScope>
    </div>
  );
}
