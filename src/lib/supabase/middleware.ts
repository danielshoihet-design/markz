import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SECURITY_HEADERS,
  contentSecurityPolicy,
} from "@/lib/security";

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy", contentSecurityPolicy());
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)));
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        // The session cookie must stay readable by the browser's Supabase
        // client (checkout, inbox actions, chat, live updates all run there),
        // so it must not be marked HttpOnly when the server refreshes it.
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            secure: process.env.NODE_ENV === "production",
          }),
        );
      },
    },
  });

  // Verifies the session token locally against the project's signing keys.
  // This runs on every request, so it must not cost a round trip to Supabase;
  // the network is only touched when an expired token needs refreshing.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path.startsWith("/_next") ||
    path.startsWith("/products") ||
    path === "/favicon.ico";

  if (!user && !isPublic && path !== "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  if (user && path === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  // Role checks are not repeated here. Every role layout and page calls
  // `requireRole`, the /api/users handlers verify the manager role themselves,
  // and RLS enforces it in the database, so a profile query on every request
  // only added latency.

  return applySecurityHeaders(supabaseResponse);
}
