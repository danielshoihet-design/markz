import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client — server only. Never import into client components. */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Admin client cannot run in the browser");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase admin credentials");
  }
  if (!key.includes("service_role") && !key.startsWith("eyJ")) {
    throw new Error("Invalid service role key");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
