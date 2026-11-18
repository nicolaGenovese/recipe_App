import { HttpError } from "@/lib/server/validation";

/** Better Auth error codes, in the app's words (translated in the browser). */
const MESSAGES: Record<string, [number, string]> = {
  USER_ALREADY_EXISTS: [409, "Esiste già un account con questa email: accedi."],
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: [409, "Esiste già un account con questa email: accedi."],
  PASSWORD_TOO_SHORT: [400, "La password deve avere almeno 8 caratteri."],
  PASSWORD_TOO_LONG: [400, "Password troppo lunga."],
  INVALID_EMAIL: [400, "Email non valida."],
  INVALID_EMAIL_OR_PASSWORD: [401, "Email o password errate."]
};

/** Turns a Better Auth failure into an HttpError with a message the app can show. */
export function authError(error: unknown): HttpError {
  const body = (error as { body?: { code?: string; message?: string } })?.body;
  const known = body?.code ? MESSAGES[body.code] : undefined;
  if (known) return new HttpError(known[0], known[1]);
  const status = Number((error as { statusCode?: number })?.statusCode) || 400;
  return new HttpError(status >= 400 && status < 600 ? status : 400, body?.message || "Operazione non riuscita.");
}
