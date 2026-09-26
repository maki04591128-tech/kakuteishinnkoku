"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateAngelTaxCapitalGainDeduction } from "@/lib/investment/angelTaxCapitalGainDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface StockRow {
  key: string;
  symbol: string;
  acquiredQuantity: string;
  acquiredCost: string;
  disposedQuantitySameYear: string;
}

function newStockRow(key: string): StockRow {
  return {
    key,
    symbol: "",
    acquiredQuantity: "0",
    acquiredCost: "0",
    disposedQuantitySameYear: "0",
  };
}

export function AngelTaxCapitalGainDeductionForm() {
  const idPrefix = useId();
  const [stocks, setStocks] = useState<StockRow[]>([newStockRow("initial")]);
  const nextRowIdRef = useRef(0);
  const [generalStockCapitalGain, setGeneralStockCapitalGain] = useState("0");
  const [listedStockCapitalGain, setListedStockCapitalGain] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateAngelTaxCapitalGainDeduction({
        stocks: stocks.map((row) => ({
          symbol: row.symbol,
          acquiredQuantity: row.acquiredQuantity || 0,
          acquiredCostJpy: row.acquiredCost || 0,
          disposedQuantitySameYear: row.disposedQuantitySameYear || 0,
        })),
        generalStockCapitalGainJpy: generalStockCapitalGain || 0,
        listedStockCapitalGainJpy: listedStockCapitalGain || 0,
      });
    } catch {
      return null;
    }
  }, [stocks, generalStockCapitalGain, listedStockCapitalGain]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            適用前の一般株式等(非上場株式)に係る譲渡所得等の金額
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={generalStockCapitalGain}
            onChange={(e) => setGeneralStockCapitalGain(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            適用前の上場株式等に係る譲渡所得等の金額
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={listedStockCapitalGain}
            onChange={(e) => setListedStockCapitalGain(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {stocks.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-5 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">
              特定株式・設立特定株式 {index + 1}
            </legend>
            <label className="flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="text-neutral-500">銘柄</span>
              <input
                type="text"
                placeholder="例: ○○株式会社"
                value={row.symbol}
                onChange={(e) =>
                  setStocks((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, symbol: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">年中の取得数量</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.acquiredQuantity}
                onChange={(e) =>
                  setStocks((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, acquiredQuantity: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">払込取得価額(合計額)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.acquiredCost}
                onChange={(e) =>
                  setStocks((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, acquiredCost: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">年中に譲渡・贈与した数量</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.disposedQuantitySameYear}
                onChange={(e) =>
                  setStocks((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, disposedQuantitySameYear: e.target.value }
                        : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setStocks((prev) => prev.filter((r) => r.key !== row.key))}
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
            setStocks((prev) => [...prev, newStockRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          銘柄を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(取得数量・取得価額・譲渡所得等の金額は0以上、年中に
          譲渡・贈与した数量は取得数量以下である必要があります)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">控除対象額の合計(限度額適用前)</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.totalDeductionBeforeLimitJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">実際に適用された控除額の合計</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalUsedJpy)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                一般株式等 {yen(result.usedAgainstGeneralStockJpy)} / 上場株式等{" "}
                {yen(result.usedAgainstListedStockJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">控除適用後の譲渡所得等の金額</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.listedStockCapitalGainAfterDeductionJpy)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                一般株式等 {yen(result.generalStockCapitalGainAfterDeductionJpy)} / 上場株式等{" "}
                {yen(result.listedStockCapitalGainAfterDeductionJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">適用しきれなかった額(繰越なし)</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.unusedJpy)}</p>
            </div>
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
