"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateExitTax } from "@/lib/investment/exitTax";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface HoldingRow {
  key: string;
  symbol: string;
  isListed: boolean;
  quantity: string;
  costBasis: string;
  valuationPrice: string;
}

function newHoldingRow(key: string): HoldingRow {
  return {
    key,
    symbol: "",
    isListed: true,
    quantity: "0",
    costBasis: "0",
    valuationPrice: "0",
  };
}

export function ExitTaxForm() {
  const idPrefix = useId();
  const [holdings, setHoldings] = useState<HoldingRow[]>([newHoldingRow("initial")]);
  const nextRowIdRef = useRef(0);
  const [residenceYears, setResidenceYears] = useState("10");

  const result = useMemo(() => {
    try {
      return estimateExitTax({
        holdings: holdings.map((row) => ({
          symbol: row.symbol,
          isListed: row.isListed,
          quantity: row.quantity || 0,
          costBasisJpy: row.costBasis || 0,
          valuationPriceJpy: row.valuationPrice || 0,
        })),
        domesticResidenceYearsInPast10Years: Number(residenceYears || 0),
      });
    } catch {
      return null;
    }
  }, [holdings, residenceYears]);

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-sm flex-col gap-1 text-sm">
        <span className="text-neutral-500">
          国外転出の日前10年以内に、国内に住所又は居所を有していた期間の合計(年)
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.1"
          value={residenceYears}
          onChange={(e) => setResidenceYears(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <div className="flex flex-col gap-3">
        {holdings.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-6 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">対象資産 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="text-neutral-500">銘柄</span>
              <input
                type="text"
                placeholder="例: ○○株式会社"
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
                value={row.isListed ? "listed" : "unlisted"}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, isListed: e.target.value === "listed" } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="listed">上場株式等</option>
                <option value="unlisted">一般株式等(非上場)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">保有数量</span>
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
              <span className="text-neutral-500">取得費(合計額)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.costBasis}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, costBasis: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">判定日時点の時価(単価)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.valuationPrice}
                onChange={(e) =>
                  setHoldings((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, valuationPrice: e.target.value } : r,
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
          対象資産を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(保有数量・取得費・時価は0以上、居住期間の年数は0以上)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">対象資産の価額の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalMarketValueJpy)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                資産基準(1億円以上): {result.meetsAssetThreshold ? "満たす" : "満たさない"}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">国外転出時課税の対象</p>
              <p className="mt-1 text-2xl font-semibold">
                {result.isSubjectToExitTax ? "対象" : "対象外"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                居住期間要件(5年超):{" "}
                {result.meetsResidencyRequirement ? "満たす" : "満たさない"}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">課税対象額の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalTaxableGainJpy)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                上場株式等 {yen(result.listedPool.taxableGainJpy)} / 一般株式等{" "}
                {yen(result.unlistedPool.taxableGainJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">税額の合計(申告分離課税20.315%)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalTaxJpy)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                所得税等 {yen(result.nationalTaxJpy)} / 住民税 {yen(result.residentTaxJpy)}
              </p>
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
