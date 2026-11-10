"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { isValidUsername, normalizeUsername, usernameToAuthEmail } from "@/lib/username";
import type { Locale, UserRole } from "@/lib/types";

function roleHome(role: UserRole) {
  if (role === "manager") return "/manager/inbox";
  if (role === "seller") return "/seller/catalog";
  return "/client/catalog";
}

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("he");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [failures, setFailures] = useState(0);
  const t = dictionaries[locale];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (Date.now() < lockUntil) {
      setError(t.errorGeneric);
      return;
    }
    const userNorm = normalizeUsername(username);
    if (!isValidUsername(userNorm)) {
      setError(t.loginFailed);
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: signIn, error: signError } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(userNorm),
      password,
    });
    if (signError) {
      const nextFailures = failures + 1;
      setFailures(nextFailures);
      if (nextFailures >= 5) {
        setLockUntil(Date.now() + 30_000);
        setFailures(0);
      }
      setError(t.loginFailed);
      setLoading(false);
      return;
    }
    // The sign-in response already carries the user, so there is no need to
    // ask the Auth server again. The role lookup and the locale save are
    // independent, so they go out together; the save is still awaited because
    // the next page renders in the stored locale.
    const user = signIn.user;
    if (!user) {
      setError(t.errorGeneric);
      setLoading(false);
      return;
    }
    localStorage.setItem("marketersz-locale", locale);
    const [{ data: profile }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.from("profiles").update({ locale }).eq("id", user.id),
    ]);
    setFailures(0);
    router.replace(roleHome((profile?.role as UserRole) || "client"));
    router.refresh();
  }

  return (
    <main
      className="app-shell flex min-h-dvh flex-col justify-center px-5 py-8"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
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

        <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
          <div className="field">
            <label htmlFor="username">{t.username}</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              maxLength={254}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              placeholder="d1981"
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t.password}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
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
