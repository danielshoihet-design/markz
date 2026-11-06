"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale, UserRole } from "@/lib/types";

function roleHome(role: UserRole) {
  if (role === "manager") return "/manager/inbox";
  if (role === "seller") return "/seller/catalog";
  return "/client/catalog";
}

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("he");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = dictionaries[locale];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signError) {
      setError(signError.message);
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t.errorGeneric);
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    localStorage.setItem("marketersz-locale", locale);
    if (profile?.role) {
      await supabase.from("profiles").update({ locale }).eq("id", user.id);
    }
    router.replace(roleHome((profile?.role as UserRole) || "client"));
    router.refresh();
  }

  return (
    <main className="app-shell flex min-h-dvh flex-col justify-center px-5 py-8" dir={locale === "he" ? "rtl" : "ltr"}>
      <div className="animate-pop card space-y-6 p-6">
        <div className="space-y-2 text-center">
          <p className="font-display text-sm font-bold tracking-[0.22em] text-accent uppercase">
            {t.brand}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">{t.login}</h1>
          <p className="text-ink-soft">{t.tagline}</p>
        </div>

        <div className="flex justify-center gap-2">
          {(["he", "en", "ru"] as Locale[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`btn !min-h-10 !px-4 text-sm ${
                locale === code ? "btn-primary" : "btn-secondary"
              }`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="field">
            <label htmlFor="email">{t.email}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t.password}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm font-semibold text-bad">{error}</p> : null}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? t.signingIn : t.login}
          </button>
        </form>
      </div>
    </main>
  );
}
