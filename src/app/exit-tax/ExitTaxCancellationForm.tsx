"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateExitTaxCancellation } from "@/lib/investment/exitTax";

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
  stillHeldAtReturn: boolean;
}

function newHoldingRow(key: string): HoldingRow {
  return {
    key,
    symbol: "",
    isListed: true,
    quantity: "0",
    costBasis: "0",
    valuationPrice: "0",
    stillHeldAtReturn: true,
  };
}

export function ExitTaxCancellationForm() {
  const idPrefix = useId();
  const [holdings, setHoldings] = useState<HoldingRow[]>([newHoldingRow("initial")]);
  const nextRowIdRef = useRef(0);
  const [residenceYears, setResidenceYears] = useState("10");
  const [exitDate, setExitDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [hasTaxDeferralExtension, setHasTaxDeferralExtension] = useState(false);

  const result = useMemo(() => {
    if (!exitDate || !returnDate) return null;
    try {
      return estimateExitTaxCancellation({
        holdings: holdings.map((row) => ({
          symbol: row.symbol,
          isListed: row.isListed,
          quantity: row.quantity || 0,
          costBasisJpy: row.costBasis || 0,
          valuationPriceJpy: row.valuationPrice || 0,
          stillHeldAtReturn: row.stillHeldAtReturn,
        })),
        domesticResidenceYearsInPast10Years: Number(residenceYears || 0),
        exitDate,
        returnDate,
        hasTaxDeferralExtension,
      });
    } catch {
      return null;
    }
  }, [holdings, residenceYears, exitDate, returnDate, hasTaxDeferralExtension]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">国外転出の日</span>
          <input
            type="date"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">帰国の日</span>
          <input
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            国外転出の日前10年以内の国内居住期間の合計(年)
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
        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasTaxDeferralExtension}
            onChange={(e) => setHasTaxDeferralExtension(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          <span className="text-neutral-500">
            納税猶予制度(所得税法137条の2)の適用を受けている(帰国期限が5年→10年)
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {holdings.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-7 dark:border-neutral-800"
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
            <label className="flex flex-col justify-end gap-1 text-sm">
              <span className="text-neutral-500">帰国時まで引き続き保有</span>
              <span className="flex items-center gap-2 py-1.5">
                <input
                  type="checkbox"
                  checked={row.stillHeldAtReturn}
                  onChange={(e) =>
                    setHoldings((prev) =>
                      prev.map((r) =>
                        r.key === row.key
                          ? { ...r, stillHeldAtReturn: e.target.checked }
                          : r,
                      ),
                    )
                  }
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <button
                  type="button"
                  onClick={() => setHoldings((prev) => prev.filter((r) => r.key !== row.key))}
                  className="ml-auto rounded-md border border-neutral-300 px-3 py-1 text-xs text-red-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  削除
                </button>
              </span>
            </label>
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
          国外転出の日・帰国の日を入力し、保有数量・取得費・時価は0以上、居住期間の年数は0以上、
          帰国の日は国外転出の日以後にしてください。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">当初、国外転出時課税の対象</p>
              <p className="mt-1 text-2xl font-semibold">
                {result.isSubjectToExitTax ? "対象" : "対象外"}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">帰国期限({result.deadlineYears}年)以内の帰国</p>
              <p className="mt-1 text-2xl font-semibold">
                {result.meetsReturnDeadline ? "満たす" : "満たさない"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                更正の請求の期限: {result.amendedReturnDeadlineDate}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">課税対象額(当初 → 取消し後)</p>
              <p className="mt-1 text-lg font-semibold">
                {yen(result.originalResult.totalTaxableGainJpy)} →{" "}
                {yen(result.revisedResult.totalTaxableGainJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">更正の請求により還付され得る税額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.refundableTaxJpy)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                当初 {yen(result.originalResult.totalTaxJpy)} → 取消し後{" "}
                {yen(result.revisedResult.totalTaxJpy)}
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
