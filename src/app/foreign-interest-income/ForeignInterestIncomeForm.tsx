"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateForeignInterestIncome } from "@/lib/foreignInterestIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface ReceiptRow {
  key: string;
  currency: string;
  amount: string;
  exchangeRate: string;
  foreignTaxWithheld: string;
}

function newReceiptRow(key: string): ReceiptRow {
  return {
    key,
    currency: "USD",
    amount: "0",
    exchangeRate: "0",
    foreignTaxWithheld: "0",
  };
}

export function ForeignInterestIncomeForm() {
  const idPrefix = useId();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([newReceiptRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return estimateForeignInterestIncome(
        receipts.map((row) => ({
          currency: row.currency.trim() || "USD",
          amountForeignCurrency: row.amount || 0,
          exchangeRateJpy: row.exchangeRate || 0,
          foreignTaxWithheldJpy: row.foreignTaxWithheld || 0,
        })),
      );
    } catch {
      return null;
    }
  }, [receipts]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {receipts.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-5 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">受取利息 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">通貨</span>
              <input
                type="text"
                placeholder="USD"
                value={row.currency}
                onChange={(e) =>
                  setReceipts((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, currency: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">受取利息額(外貨建て)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.amount}
                onChange={(e) =>
                  setReceipts((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">受取時点の円換算レート(1単位あたり)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.exchangeRate}
                onChange={(e) =>
                  setReceipts((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, exchangeRate: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">現地で源泉徴収された外国所得税額(円換算)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.foreignTaxWithheld}
                onChange={(e) =>
                  setReceipts((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, foreignTaxWithheld: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setReceipts((prev) => prev.filter((r) => r.key !== row.key))}
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
            setReceipts((prev) => [...prev, newReceiptRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          受取利息を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(受取利息額は正の値、円換算レート・外国所得税額は0以上)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">利子所得の金額の合計(総合課税)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalInterestIncomeJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">外国税額控除の対象になり得る外国所得税額</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalForeignTaxWithheldJpy)}
              </p>
            </div>
          </div>

          {result.byCurrency.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-neutral-500 dark:border-neutral-700">
                    <th className="py-2 pr-4">通貨</th>
                    <th className="py-2 pr-4">受取件数</th>
                    <th className="py-2 pr-4">受取利息額(外貨建て)</th>
                    <th className="py-2 pr-4">利子所得の金額</th>
                    <th className="py-2 pr-4">外国所得税額</th>
                  </tr>
                </thead>
                <tbody>
                  {result.byCurrency.map((row) => (
                    <tr
                      key={row.currency}
                      className="border-b border-neutral-100 dark:border-neutral-900"
                    >
                      <td className="py-2 pr-4 font-medium">{row.currency}</td>
                      <td className="py-2 pr-4">{row.receiptCount}</td>
                      <td className="py-2 pr-4">
                        {row.totalAmountForeignCurrency.toString()}
                      </td>
                      <td className="py-2 pr-4">{yen(row.interestIncomeJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.foreignTaxWithheldJpy)}</td>
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
