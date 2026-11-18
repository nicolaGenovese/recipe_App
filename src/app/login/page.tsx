import { LoginForm } from "@/app/login/LoginForm";
import { AccountLogin } from "@/app/login/AccountLogin";
import { accessPassword } from "@/lib/server/access";
import { database } from "@/lib/server/db";
import { firstCompanyUnclaimed } from "@/lib/server/directory";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

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
  return <AccountLogin target={target} claim={claim} appPassword={Boolean(accessPassword())} />;
}
