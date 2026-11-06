import { redirect } from "next/navigation";
import { getSessionProfile, homeForRole } from "@/lib/auth";

export default async function HomePage() {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) redirect("/login");
  redirect(homeForRole(profile.role));
}
