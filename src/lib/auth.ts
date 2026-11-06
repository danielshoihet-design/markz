import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile: profile as Profile | null };
}

export async function requireRole(roles: UserRole[]) {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user || !profile) redirect("/login");
  if (!roles.includes(profile.role)) {
    redirect(homeForRole(profile.role));
  }
  return { supabase, user, profile };
}

export function homeForRole(role: UserRole) {
  if (role === "manager") return "/manager/inbox";
  if (role === "seller") return "/seller/catalog";
  return "/client/catalog";
}
