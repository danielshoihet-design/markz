import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends a session that has a valid token but no profile row (for example a
 * deleted account whose token has not expired yet). Pages cannot clear cookies
 * themselves, so they redirect here; without this the user would bounce
 * between /login and / until the token expired.
 *
 * A session that does have a profile is left alone, so visiting this URL
 * cannot be used to log someone out.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (userId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: "Could not verify session" }, { status: 503 });
    }
    if (profile) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    await supabase.auth.signOut({ scope: "local" });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
