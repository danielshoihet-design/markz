"use client";

import { FormEvent, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export function SetPasswordForm({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOk("");
    const res = await fetch("/api/users/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : t.errorGeneric);
      setLoading(false);
      return;
    }
    setOk(t.passwordChanged);
    setPassword("");
    setLoading(false);
    setOpen(false);
  }

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        className="btn btn-secondary !min-h-10 !px-3 text-sm"
        onClick={() => {
          setOpen((v) => !v);
          setError("");
          setOk("");
          setPassword("");
        }}
      >
        {t.changePassword}
      </button>

      {ok ? <p className="text-sm font-semibold text-ok">{ok}</p> : null}

      {open ? (
        <form
          onSubmit={onSubmit}
          className="space-y-2 rounded-2xl border border-line bg-cream p-3"
        >
          <p className="text-sm font-semibold">
            {t.changePassword}: {userName}
          </p>
          <input
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password}
            className="min-h-11 w-full rounded-xl border border-line bg-white px-3"
          />
          <p className="text-xs text-ink-soft">{t.passwordHint}</p>
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary !min-h-10 flex-1" disabled={loading}>
              {t.save}
            </button>
            <button
              type="button"
              className="btn btn-ghost !min-h-10"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
