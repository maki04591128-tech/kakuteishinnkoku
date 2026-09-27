"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  estimateOldNisaExpiryTransfer,
  type OldNisaType,
} from "@/lib/investment/oldNisaExpiry";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface HoldingRow {
  key: string;
  symbol: string;
  nisaType: OldNisaType;
  acquiredYear: string;
  quantity: string;
  originalCostBasis: string;
  expiryClosingPrice: string;
}

function newHoldingRow(key: string): HoldingRow {
  return {
    key,
    symbol: "",
    nisaType: "GENERAL_OLD",
    acquiredYear: "2021",
    quantity: "0",
    originalCostBasis: "0",
    expiryClosingPrice: "0",
  };
}

export function OldNisaExpiryForm() {
  const idPrefix = useId();
  const [holdings, setHoldings] = useState<HoldingRow[]>([newHoldingRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return estimateOldNisaExpiryTransfer({
        holdings: holdings.map((row) => ({
          symbol: row.symbol,
          nisaType: row.nisaType,
          acquiredYear: Number(row.acquiredYear || 0),
          quantity: row.quantity || 0,
          originalCostBasisJpy: row.originalCostBasis || 0,
          expiryClosingPriceJpy: row.expiryClosingPrice || 0,
        })),
      });
    } catch {
      return null;
    }
  }, [holdings]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {holdings.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-6 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">銘柄 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">銘柄</span>
              <input
                type="text"
                placeholder="例: ○○投資信託"
                value={row.symbol}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, symbol: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">区分</span>
              <select
                value={row.nisaType}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, nisaType: e.target.value as OldNisaType }
                        : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="GENERAL_OLD">一般NISA(非課税期間5年)</option>
                <option value="TSUMITATE_OLD">つみたてNISA(非課税期間20年)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">買付年</span>
              <input
                type="number"
                inputMode="numeric"
                value={row.acquiredYear}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, acquiredYear: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">買付数量</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.quantity}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, quantity: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">買付時の取得費(合計額)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.originalCostBasis}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, originalCostBasis: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">非課税期間最終年の最終営業日終値(単価)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.expiryClosingPrice}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, expiryClosingPrice: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setHoldings((prev) => prev.filter((r) => r.key !== row.key))}
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
            setHoldings((prev) => [...prev, newHoldingRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          銘柄を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(買付数量・取得費・終値は0以上、買付年は整数で入力すること)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">買付時の取得費の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalOriginalCostBasisJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">付け替え後の新しい取得価額の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalNewCostBasisJpy)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                /importの期首残高セクションへの登録値の参考値
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">非課税のまま確定する含み益・含み損の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalUntaxedGainJpy)}</p>
              {result.totalDisallowedLossJpy.greaterThan(0) && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  うち切り捨てられる含み損: {yen(result.totalDisallowedLossJpy)}
                </p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
                  <th className="py-2 pr-3">銘柄</th>
                  <th className="py-2 pr-3">区分</th>
                  <th className="py-2 pr-3">非課税期間最終年</th>
                  <th className="py-2 pr-3">払出し年</th>
                  <th className="py-2 pr-3">新しい取得価額</th>
                  <th className="py-2 pr-3">非課税の含み益/損</th>
                </tr>
              </thead>
              <tbody>
                {result.holdings.map((h, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                    <td className="py-2 pr-3">{h.symbol || `銘柄${i + 1}`}</td>
                    <td className="py-2 pr-3">
                      {h.nisaType === "GENERAL_OLD" ? "一般NISA" : "つみたてNISA"}
                    </td>
                    <td className="py-2 pr-3">
                      {h.expiryYear}年
                      {!h.isAcquisitionYearInExpectedRange && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                          (買付年が制度上の投資可能期間外)
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{h.transferYear}年</td>
                    <td className="py-2 pr-3">{yen(h.newCostBasisJpy)}</td>
                    <td className="py-2 pr-3">{yen(h.untaxedGainJpy)}</td>
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
