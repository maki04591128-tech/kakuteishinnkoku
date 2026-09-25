"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateGeneralTransferIncome } from "@/lib/generalTransferIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface TransferRow {
  key: string;
  description: string;
  transferPrice: string;
  acquisitionCost: string;
  transferExpenses: string;
  ownershipYears: string;
}

function newTransferRow(key: string): TransferRow {
  return {
    key,
    description: "",
    transferPrice: "0",
    acquisitionCost: "0",
    transferExpenses: "0",
    ownershipYears: "0",
  };
}

export function GeneralTransferIncomeForm() {
  const idPrefix = useId();
  const [items, setItems] = useState<TransferRow[]>([newTransferRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return estimateGeneralTransferIncome({
        items: items.map((row) => ({
          description: row.description,
          transferPriceJpy: row.transferPrice || 0,
          acquisitionCostJpy: row.acquisitionCost || 0,
          transferExpensesJpy: row.transferExpenses || 0,
          ownershipYears: Number(row.ownershipYears || 0),
        })),
      });
    } catch {
      return null;
    }
  }, [items]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {items.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-5 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">譲渡資産 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="text-neutral-500">資産の内容</span>
              <input
                type="text"
                placeholder="自動車・ゴルフ会員権等"
                value={row.description}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, description: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">譲渡価額</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.transferPrice}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, transferPrice: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">取得費</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.acquisitionCost}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, acquisitionCost: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">譲渡費用</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.transferExpenses}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, transferExpenses: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">所有期間(年・譲渡日時点)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={row.ownershipYears}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, ownershipYears: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((r) => r.key !== row.key))}
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
            setItems((prev) => [...prev, newTransferRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          譲渡資産を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(譲渡価額・取得費・譲渡費用は0以上、所有期間は0以上の整数)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">短期譲渡所得(特別控除後)</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.shortTermIncomeJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">長期譲渡所得(特別控除後・2分の1前)</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.longTermIncomeJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">特別控除額の合計(最高50万円)</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.specialDeductionTotalJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">総所得金額に算入する額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.taxableAmountJpy)}</p>
            </div>
          </div>

          {(result.shortTermLossJpy.greaterThan(0) || result.longTermLossJpy.greaterThan(0)) && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {result.shortTermLossJpy.greaterThan(0) &&
                `短期区分で ${yen(result.shortTermLossJpy)} の譲渡損失が生じています。`}
              {result.longTermLossJpy.greaterThan(0) &&
                `長期区分で ${yen(result.longTermLossJpy)} の譲渡損失が生じています。`}
              本ツールではこの損失を他区分や他の所得と自動的に通算しない(0円として計算)。実際に損益通算できるかどうかは国税庁や税理士に確認すること。
            </p>
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
