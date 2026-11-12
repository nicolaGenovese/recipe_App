import { LoginForm } from "@/app/login/LoginForm";
import { accessPassword } from "@/lib/server/access";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only local paths are allowed, so the login page cannot send anyone to another site.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <LoginForm target={target} configured={Boolean(accessPassword())} />;
}
