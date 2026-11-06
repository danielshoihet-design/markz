"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";

export function GrantCreditsForm({
  clientId,
  clientName,
  currentDebt,
}: {
  clientId: string;
  clientName: string;
  currentDebt: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"settle" | "add" | null>(null);
  const [amount, setAmount] = useState(String(Math.max(1, Math.round(currentDebt) || 100)));
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mode) return;
    setLoading(true);
    setError("");
    setOk("");
    const supabase = createClient();
    const { error: rpcError } =
      mode === "settle"
        ? await supabase.rpc("settle_credit", {
            p_client_id: clientId,
            p_amount: Number(amount),
            p_reason: "credit payment collected",
          })
        : await supabase.rpc("grant_credits", {
            p_client_id: clientId,
            p_amount: Number(amount),
            p_reason: "manual credit",
          });
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    setOk(mode === "settle" ? t.creditSettled : t.creditGranted);
    setLoading(false);
    setMode(null);
    router.refresh();
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary !min-h-10 !px-3 text-sm"
          disabled={currentDebt <= 0}
          onClick={() => {
            setMode("settle");
            setAmount(String(Math.max(1, Math.round(currentDebt))));
            setOk("");
          }}
        >
          {t.settleCredit}
        </button>
        <button
          type="button"
          className="btn btn-secondary !min-h-10 !px-3 text-sm"
          onClick={() => {
            setMode("add");
            setAmount("100");
            setOk("");
          }}
        >
          {t.addCredits}
        </button>
      </div>

      {ok ? <p className="text-sm font-semibold text-ok">{ok}</p> : null}

      {mode ? (
        <form onSubmit={onSubmit} className="space-y-2 rounded-2xl border border-line bg-cream p-3">
          <p className="text-sm font-semibold">
            {mode === "settle" ? t.settleCredit : t.addCredits}: {clientName}
          </p>
          <input
            type="number"
            min={1}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-white px-3"
          />
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary !min-h-10 flex-1" disabled={loading}>
              {t.save}
            </button>
            <button type="button" className="btn btn-ghost !min-h-10" onClick={() => setMode(null)}>
              ×
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
