"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  productName,
  type Order,
  type Product,
  type Supply,
} from "@/lib/types";

export function ManagerInbox({
  initialOrders,
  initialSupplies,
}: {
  initialOrders: Order[];
  initialSupplies: Supply[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [supplies, setSupplies] = useState(initialSupplies);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [partialId, setPartialId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");

  useEffect(() => {
    setOrders(initialOrders);
    setSupplies(initialSupplies);
  }, [initialOrders, initialSupplies]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("manager-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "supplies" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  async function recordPayment(id: string, amountPaid: number) {
    setBusyId(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("record_order_payment", {
      p_order_id: id,
      p_amount_paid: amountPaid,
    });
    setBusyId(null);
    setPartialId(null);
    setPartialAmount("");
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  async function updateSupply(id: string, status: string) {
    setBusyId(id);
    const supabase = createClient();
    await supabase.rpc("update_supply_status", {
      p_supply_id: id,
      p_status: status,
    });
    setBusyId(null);
    router.refresh();
  }

  function paymentLabel(order: Order) {
    if (!order.payment_status) return t.awaitingPayment;
    if (order.payment_status === "paid") return t.paid;
    if (order.payment_status === "partial") return t.partialPay;
    return t.unpaid;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">{t.newOrder}</h2>
        {orders.length === 0 ? (
          <div className="card p-5 text-center text-ink-soft">{t.noItems}</div>
        ) : (
          orders.map((order) => {
            const due = Math.max(0, Number(order.total) - Number(order.amount_paid || 0));
            return (
              <article key={order.id} className="card animate-rise space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink-soft">
                      {t.from}: {order.profiles?.full_name || "—"}
                    </p>
                    <p className="font-display text-xl font-bold">
                      {formatMoney(Number(order.total), locale)}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {formatDate(order.created_at, locale)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={order.status} />
                    <span
                      className={`badge ${
                        order.payment_status === "paid"
                          ? "badge-ok"
                          : order.payment_status
                            ? "badge-warn"
                            : "badge-bad"
                      }`}
                    >
                      {paymentLabel(order)}
                    </span>
                  </div>
                </div>

                <ul className="space-y-1 rounded-2xl bg-cream px-3 py-2 text-sm">
                  {(order.order_items || []).map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>
                        {item.products
                          ? productName(item.products as Product, locale)
                          : "—"}
                      </span>
                      <span className="font-semibold">
                        {formatQty(Number(item.quantity), locale)}{" "}
                        {(item.products as Product | null)?.unit === "unit" ? t.unit : t.kg} ·{" "}
                        {formatMoney(Number(item.quantity) * Number(item.unit_price), locale)}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between border-t border-line pt-2 font-bold">
                    <span>{t.total}</span>
                    <span>{formatMoney(Number(order.total), locale)}</span>
                  </li>
                </ul>

                {order.payment_status ? (
                  <p className="text-sm text-ink-soft">
                    {t.amountPaid}: {formatMoney(Number(order.amount_paid || 0), locale)}
                    {due > 0 ? ` · ${t.remaining}: ${formatMoney(due, locale)}` : ""}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary !min-h-11 flex-1"
                        disabled={busyId === order.id}
                        onClick={() => recordPayment(order.id, Number(order.total))}
                      >
                        {t.paidFull}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger !min-h-11 flex-1"
                        disabled={busyId === order.id}
                        onClick={() => recordPayment(order.id, 0)}
                      >
                        {t.unpaid}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary !min-h-11 flex-1"
                        disabled={busyId === order.id}
                        onClick={() => {
                          setPartialId(order.id);
                          setPartialAmount(String(Math.round(Number(order.total) / 2)));
                        }}
                      >
                        {t.partialPay}
                      </button>
                    </div>
                    {partialId === order.id ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          max={Number(order.total)}
                          step={1}
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          className="min-h-11 flex-1 rounded-xl border border-line bg-white px-3"
                          placeholder={t.amountPaid}
                        />
                        <button
                          type="button"
                          className="btn btn-primary !min-h-11"
                          disabled={busyId === order.id}
                          onClick={() => recordPayment(order.id, Number(partialAmount) || 0)}
                        >
                          {t.save}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">{t.newSupply}</h2>
        {supplies.length === 0 ? (
          <div className="card p-5 text-center text-ink-soft">{t.noItems}</div>
        ) : (
          supplies.map((supply) => (
            <article key={supply.id} className="card animate-rise space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-soft">
                    {t.from}: {supply.profiles?.full_name || "—"}
                  </p>
                  <p className="font-display text-xl font-bold">
                    {formatMoney(Number(supply.total), locale)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {formatDate(supply.created_at, locale)}
                  </p>
                </div>
                <StatusBadge status={supply.status} />
              </div>
              <ul className="space-y-1 text-sm">
                {(supply.supply_items || []).map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>
                      {item.products
                        ? productName(item.products as Product, locale)
                        : "—"}
                    </span>
                    <span>
                      {formatQty(Number(item.quantity), locale)}{" "}
                      {(item.products as Product | null)?.unit === "unit" ? t.unit : t.kg}
                    </span>
                  </li>
                ))}
              </ul>
              {supply.status === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary !min-h-11 flex-1"
                    disabled={busyId === supply.id}
                    onClick={() => updateSupply(supply.id, "accepted")}
                  >
                    {t.paySupplier} · {formatMoney(Number(supply.total), locale)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger !min-h-11 flex-1"
                    disabled={busyId === supply.id}
                    onClick={() => updateSupply(supply.id, "rejected")}
                  >
                    {t.reject}
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
