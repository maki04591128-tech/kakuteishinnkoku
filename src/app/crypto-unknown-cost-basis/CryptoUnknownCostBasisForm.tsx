"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateCryptoIncomeWithUnknownCostBasis } from "@/lib/crypto/unknownCostBasis";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface TradeRow {
  key: string;
  label: string;
  proceeds: string;
  /** 空文字の場合は「取得費不明」として扱う */
  actualAcquisitionCost: string;
}

function newTradeRow(key: string): TradeRow {
  return { key, label: "", proceeds: "0", actualAcquisitionCost: "" };
}

export function CryptoUnknownCostBasisForm() {
  const idPrefix = useId();
  const [trades, setTrades] = useState<TradeRow[]>([newTradeRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return estimateCryptoIncomeWithUnknownCostBasis({
        trades: trades.map((row) => ({
          label: row.label,
          proceedsJpy: row.proceeds || 0,
          actualAcquisitionCostJpy:
            row.actualAcquisitionCost.trim() === "" ? null : row.actualAcquisitionCost,
        })),
      });
    } catch {
      return null;
    }
  }, [trades]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {trades.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-4 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">取引 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">内容(任意)</span>
              <input
                type="text"
                placeholder="例: ○○取引所で購入したBTCの売却"
                value={row.label}
                onChange={(e) =>
                  setTrades((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, label: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">収入金額(売却価額等)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.proceeds}
                onChange={(e) =>
                  setTrades((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, proceeds: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">
                実際の取得費(確認できる場合のみ入力。空欄は「不明」として5%相当額を使う)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="不明"
                value={row.actualAcquisitionCost}
                onChange={(e) =>
                  setTrades((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, actualAcquisitionCost: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setTrades((prev) => prev.filter((r) => r.key !== row.key))}
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
            setTrades((prev) => [...prev, newTradeRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          取引を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(収入金額・取得費は0以上で入力すること)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">収入金額の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalProceedsJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">採用した取得費の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalAcquisitionCostJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">雑所得(合計)</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.totalMiscellaneousIncomeJpy)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
                  <th className="py-2 pr-3">内容</th>
                  <th className="py-2 pr-3">収入金額</th>
                  <th className="py-2 pr-3">採用した取得費</th>
                  <th className="py-2 pr-3">雑所得</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                    <td className="py-2 pr-3">{t.label || `取引${i + 1}`}</td>
                    <td className="py-2 pr-3">{yen(t.proceedsJpy)}</td>
                    <td className="py-2 pr-3">
                      {yen(t.acquisitionCostJpy)}
                      {t.estimatedApplied && (
                        <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                          (概算取得費5%を適用)
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{yen(t.miscellaneousIncomeJpy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
