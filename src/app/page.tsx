import { redirectToHome } from "@/lib/auth";

export default async function HomePage() {
  await redirectToHome();
}
