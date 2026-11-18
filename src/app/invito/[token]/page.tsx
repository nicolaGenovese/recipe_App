import { headers } from "next/headers";
import { InviteView } from "@/app/invito/[token]/InviteView";
import { sessionUser } from "@/lib/server/auth/context";
import { database } from "@/lib/server/db";
import { inviteInfo } from "@/lib/server/directory";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** The page an invite link opens: who invites to what, then sign up or sign in and accept. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = database();
  if (!db || !/^inv_[a-z0-9]{20,64}$/.test(token)) return <InviteView token={token} info={null} user={null} />;
  await getStore().ready();
  const [info, user] = await Promise.all([inviteInfo(db.sql, token), sessionUser(await headers()).catch(() => null)]);
  return <InviteView token={token} info={info} user={user} />;
}
