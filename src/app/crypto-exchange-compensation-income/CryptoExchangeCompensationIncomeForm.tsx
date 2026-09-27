"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateExchangeCompensationIncome } from "@/lib/crypto/exchangeCompensationIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface EventRow {
  key: string;
  symbol: string;
  compensationAmount: string;
  acquisitionCost: string;
}

function newEventRow(key: string): EventRow {
  return {
    key,
    symbol: "BTC",
    compensationAmount: "0",
    acquisitionCost: "0",
  };
}

export function CryptoExchangeCompensationIncomeForm() {
  const idPrefix = useId();
  const [events, setEvents] = useState<EventRow[]>([newEventRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return estimateExchangeCompensationIncome(
        events.map((row) => ({
          symbol: row.symbol.trim() || "BTC",
          compensationAmountJpy: row.compensationAmount || 0,
          acquisitionCostJpy: row.acquisitionCost || 0,
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
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-4 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">補償イベント {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">銘柄シンボル</span>
              <input
                type="text"
                placeholder="BTC"
                value={row.symbol}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, symbol: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">受け取った補償金額</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.compensationAmount}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, compensationAmount: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">
                返還できなくなった暗号資産の取得費(総平均法・移動平均法)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.acquisitionCost}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, acquisitionCost: e.target.value } : r,
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
          補償イベントを追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(銘柄シンボルは必須、補償金額・取得費は0以上)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">雑所得の金額の合計(マイナスは損失)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalGainOrLossJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">補償金額の合計(収入金額)</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.totalCompensationAmountJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">取得費の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalAcquisitionCostJpy)}</p>
            </div>
          </div>

          {result.bySymbol.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-neutral-500 dark:border-neutral-700">
                    <th className="py-2 pr-4">銘柄</th>
                    <th className="py-2 pr-4">件数</th>
                    <th className="py-2 pr-4">補償金額</th>
                    <th className="py-2 pr-4">取得費</th>
                    <th className="py-2 pr-4">雑所得(マイナスは損失)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.bySymbol.map((row) => (
                    <tr
                      key={row.symbol}
                      className="border-b border-neutral-100 dark:border-neutral-900"
                    >
                      <td className="py-2 pr-4 font-medium">{row.symbol}</td>
                      <td className="py-2 pr-4">{row.eventCount}</td>
                      <td className="py-2 pr-4">{yen(row.compensationAmountJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.acquisitionCostJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.gainOrLossJpy)}</td>
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
