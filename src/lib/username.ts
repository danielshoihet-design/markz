/** Internal auth email domain — not shown to users */
export const AUTH_EMAIL_DOMAIN = "marketersz.local";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$|^[a-z0-9]{2,32}$/;

/** Accept username or legacy email (uses the part before @). */
export function normalizeUsername(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at > 0) return trimmed.slice(0, at);
  return trimmed;
}

export function isValidUsername(raw: string): boolean {
  const u = normalizeUsername(raw);
  if (u.length < 2 || u.length > 32) return false;
  return USERNAME_RE.test(u);
}

export function usernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}
