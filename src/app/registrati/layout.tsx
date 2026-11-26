import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { LanguageScope } from "@/app/login/AccountForms";
import { LANGUAGE_COOKIE, serverLanguage } from "@/lib/i18n";

/** Sign up comes out of the server in the visitor's language, like the sign in page. */
export default async function RegisterLayout({ children }: { children: ReactNode }) {
  const language = serverLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value, (await headers()).get("accept-language"));
  return <LanguageScope language={language}>{children}</LanguageScope>;
}
