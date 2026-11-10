import { NextRequest } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Strong password: 10+ chars, upper, lower, digit */
export function isStrongPassword(password: string): boolean {
  if (password.length < 10 || password.length > 128) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function sanitizeText(input: string, max = 200): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

/** Reject cross-site POSTs when Origin/Referer present and mismatched */
export function assertSameOrigin(request: NextRequest | Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    // Same-origin navigations may omit Origin; allow if no Origin (browser GET)
    // For mutating APIs we prefer Origin when present
    if (request.method === "GET" || request.method === "HEAD") return true;
    // Mobile/webviews sometimes omit Origin — fall back to Referer
    const referer = request.headers.get("referer");
    if (!referer) return true;
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple in-memory rate limit (per serverless instance). */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0 };
  }
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

export function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "X-DNS-Prefetch-Control": "off",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export function contentSecurityPolicy(): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let supabaseHost = "";
  try {
    supabaseHost = new URL(supabase).origin;
  } catch {
    supabaseHost = "";
  }

  const connectSrc = ["'self'", supabaseHost, "https://*.supabase.co"]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Next.js requires 'unsafe-inline' for some styles; scripts stay strict in prod where possible
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    `connect-src ${connectSrc} wss://*.supabase.co`,
    "upgrade-insecure-requests",
  ].join("; ");
}
