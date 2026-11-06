"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { UserRole } from "@/lib/types";

export function CreateUserForm({ role }: { role: Extract<UserRole, "client" | "seller"> }) {
  const { t } = useI18n();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOk("");
    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, role }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || t.errorGeneric);
      setLoading(false);
      return;
    }
    setOk(t.userCreated);
    setFullName("");
    setEmail("");
    setPassword("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-4">
      <h3 className="font-display text-lg font-bold">
        {role === "client" ? t.createClient : t.createSeller}
      </h3>
      <div className="field">
        <label htmlFor="fullName">{t.fullName}</label>
        <input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="email">{t.email}</label>
        <input
          id="email"
          type="email"
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
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm font-semibold text-bad">{error}</p> : null}
      {ok ? <p className="text-sm font-semibold text-ok">{ok}</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {t.createUser}
      </button>
    </form>
  );
}
