"use client";

import { useId, useMemo, useRef, useState } from "react";
import { calculateCapitalReturnDistributions } from "@/lib/investment/capitalReturnDistribution";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${n.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}`;
}

interface EventRow {
  key: string;
  label: string;
  distribution: string;
  deemedDividend: string;
  paybackRatio: string;
}

function newEventRow(key: string, index: number): EventRow {
  return {
    key,
    label: `第${index}回`,
    distribution: "0",
    deemedDividend: "0",
    paybackRatio: "0",
  };
}

export function CapitalReturnDistributionForm() {
  const idPrefix = useId();
  const [openingAcquisitionCost, setOpeningAcquisitionCost] = useState("320000");
  const [holdingUnits, setHoldingUnits] = useState("10");
  const [events, setEvents] = useState<EventRow[]>([newEventRow("initial", 1)]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return calculateCapitalReturnDistributions(
        openingAcquisitionCost || 0,
        Number(holdingUnits || 0),
        events.map((row) => ({
          label: row.label,
          distributionPerUnitJpy: row.distribution || 0,
          deemedDividendPerUnitJpy: row.deemedDividend || 0,
          paybackRatio: row.paybackRatio || 0,
        })),
      );
    } catch {
      return null;
    }
  }, [openingAcquisitionCost, holdingUnits, events]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">従前の1口当たり取得価額</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={openingAcquisitionCost}
            onChange={(e) => setOpeningAcquisitionCost(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">保有口数</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={holdingUnits}
            onChange={(e) => setHoldingUnits(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {events.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-5 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">出資等減少分配 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">ラベル(決算期等)</span>
              <input
                type="text"
                value={row.label}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, label: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">1口当たり出資等減少分配額</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.distribution}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, distribution: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">1口当たりみなし配当額</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.deemedDividend}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, deemedDividend: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">払戻等割合(通知値。例: 0.001)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={1}
                step="0.0001"
                value={row.paybackRatio}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, paybackRatio: e.target.value } : r,
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
            setEvents((prev) => [...prev, newEventRow(key, prev.length + 1)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          分配を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(取得価額・分配額・みなし配当額は0以上、保有口数は正の整数、
          払戻等割合は0以上1以下、みなし配当額は分配額以下である必要があります)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">みなし配当額の合計(配当所得)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalDeemedDividendJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
              <p className="text-sm text-neutral-500">
                みなし譲渡損益の合計(上場株式等の譲渡所得等)
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalDeemedTransferGainLossJpy)}
              </p>
            </div>
          </div>

          <p className="text-sm text-neutral-500">
            最終的な1口当たり取得価額:{" "}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {yen(result.closingAcquisitionCostPerUnitJpy)}
            </span>
            (取得価額の合計: {yen(result.closingTotalAcquisitionCostJpy)})
          </p>

          {result.events.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-neutral-500 dark:border-neutral-700">
                    <th className="py-2 pr-4">ラベル</th>
                    <th className="py-2 pr-4">分配前取得価額(1口)</th>
                    <th className="py-2 pr-4">みなし配当額</th>
                    <th className="py-2 pr-4">みなし譲渡収入金額</th>
                    <th className="py-2 pr-4">投資口の譲渡原価</th>
                    <th className="py-2 pr-4">みなし譲渡損益</th>
                    <th className="py-2 pr-4">分配後取得価額(1口)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.events.map((row) => (
                    <tr key={row.label} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-2 pr-4 font-medium">{row.label}</td>
                      <td className="py-2 pr-4">{yen(row.openingAcquisitionCostPerUnitJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.deemedDividendJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.deemedTransferProceedsJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.deemedAcquisitionCostJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.deemedTransferGainLossJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.closingAcquisitionCostPerUnitJpy)}</td>
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
