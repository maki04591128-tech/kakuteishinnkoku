"use client";

import { useId, useMemo, useRef, useState } from "react";
import { calculateForeignCurrencyDepositPortfolioYear } from "@/lib/foreignCurrencyDeposit";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface EventRow {
  key: string;
  currency: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: string;
  exchangeRate: string;
}

function newEventRow(key: string): EventRow {
  return {
    key,
    currency: "USD",
    type: "DEPOSIT",
    amount: "0",
    exchangeRate: "0",
  };
}

export function ForeignCurrencyDepositForm() {
  const idPrefix = useId();
  const [events, setEvents] = useState<EventRow[]>([newEventRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return calculateForeignCurrencyDepositPortfolioYear(
        events.map((row) => ({
          currency: row.currency.trim() || "USD",
          type: row.type,
          amount: row.amount || 0,
          exchangeRateJpy: row.exchangeRate || 0,
        })),
      );
    } catch {
      return null;
    }
  }, [events]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {events.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-5 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">預入・払出 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">通貨</span>
              <input
                type="text"
                placeholder="USD"
                value={row.currency}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, currency: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">区分</span>
              <select
                value={row.type}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, type: e.target.value as EventRow["type"] }
                        : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="DEPOSIT">預入(取得)</option>
                <option value="WITHDRAWAL">払出(円への交換・他資産の購入等)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">数量(外貨建て)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.amount}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">円換算レート(1単位あたり)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.exchangeRate}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, exchangeRate: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setEvents((prev) => prev.filter((r) => r.key !== row.key))}
              className="self-end rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-red-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              削除
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => {
            const key = `${idPrefix}-${nextRowIdRef.current}`;
            nextRowIdRef.current += 1;
            setEvents((prev) => [...prev, newEventRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          預入・払出を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(数量は正の値、円換算レートは0以上、払出数量は保有数量以下)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">為替差損益の合計(雑所得)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalRealizedGainJpy)}</p>
            </div>
          </div>

          {result.byCurrency.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-neutral-500 dark:border-neutral-700">
                    <th className="py-2 pr-4">通貨</th>
                    <th className="py-2 pr-4">平均取得レート</th>
                    <th className="py-2 pr-4">払出数量</th>
                    <th className="py-2 pr-4">払出額</th>
                    <th className="py-2 pr-4">払出分の取得原価</th>
                    <th className="py-2 pr-4">為替差損益</th>
                    <th className="py-2 pr-4">期末残高</th>
                  </tr>
                </thead>
                <tbody>
                  {result.byCurrency.map((row) => (
                    <tr key={row.currency} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-2 pr-4 font-medium">{row.currency}</td>
                      <td className="py-2 pr-4">{yen(row.averageRateJpy)}</td>
                      <td className="py-2 pr-4">{row.withdrawnAmount.toString()}</td>
                      <td className="py-2 pr-4">{yen(row.proceedsJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.costOfWithdrawnJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.realizedGainJpy)}</td>
                      <td className="py-2 pr-4">
                        {row.closingAmount.toString()}({yen(row.closingCostJpy)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
            {result.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
