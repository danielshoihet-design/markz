import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

/** Clears a session whose profile no longer exists, then sends the user to /login. */
const RESET_SESSION_PATH = "/auth/reset";

/**
 * Session + profile for the current request.
 *
 * Wrapped in `cache` so the role layout and the page share one lookup instead
 * of each doing their own. The JWT is verified locally against the project's
 * signing keys (`getClaims`), so the profile row is the only network call.
 * Authorization still comes from the `profiles` row and from RLS, never from
 * the token contents.
 */
export const getSessionProfile = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { supabase, user: null, profile: null };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load profile: ${error.message}`);

  return { supabase, user: { id: userId }, profile: profile as Profile | null };
});

export async function requireRole(roles: UserRole[]) {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  if (!profile) redirect(RESET_SESSION_PATH);
  if (!roles.includes(profile.role)) {
    redirect(homeForRole(profile.role));
  }
  return { supabase, user, profile };
}

export async function redirectToHome(): Promise<never> {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  if (!profile) redirect(RESET_SESSION_PATH);
  redirect(homeForRole(profile.role));
}

export function homeForRole(role: UserRole) {
  if (role === "manager") return "/manager/inbox";
  if (role === "seller") return "/seller/catalog";
  return "/client/catalog";
}
