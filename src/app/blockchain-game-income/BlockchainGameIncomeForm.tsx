"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateBlockchainGameIncome } from "@/lib/blockchainGameIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface TokenRow {
  key: string;
  description: string;
  isGameOnlyToken: boolean;
  openingBalance: string;
  closingBalance: string;
  purchasedAmount: string;
  hasYearEndMarketValue: boolean;
  yearEndRate: string;
  midYearCryptoExchangeValue: string;
}

function newTokenRow(key: string): TokenRow {
  return {
    key,
    description: "",
    isGameOnlyToken: false,
    openingBalance: "0",
    closingBalance: "0",
    purchasedAmount: "0",
    hasYearEndMarketValue: true,
    yearEndRate: "0",
    midYearCryptoExchangeValue: "0",
  };
}

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900";

export function BlockchainGameIncomeForm() {
  const idPrefix = useId();
  const [items, setItems] = useState<TokenRow[]>([newTokenRow("initial")]);
  const nextRowIdRef = useRef(0);

  const updateRow = (key: string, patch: Partial<TokenRow>) => {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const result = useMemo(() => {
    try {
      return estimateBlockchainGameIncome({
        items: items.map((row) => ({
          description: row.description,
          isGameOnlyToken: row.isGameOnlyToken,
          openingBalance: row.openingBalance || 0,
          closingBalance: row.closingBalance || 0,
          purchasedAmount: row.purchasedAmount || 0,
          hasYearEndMarketValue: row.hasYearEndMarketValue,
          yearEndRateJpy: row.yearEndRate || 0,
          midYearCryptoExchangeValueJpy: row.midYearCryptoExchangeValue || 0,
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
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-4 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">
              ゲーム内通貨(トークン) {index + 1}
            </legend>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-neutral-500">ゲーム名・トークン名</span>
              <input
                type="text"
                placeholder="ブロックチェーンゲームA等"
                value={row.description}
                onChange={(e) => updateRow(row.key, { description: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col justify-end gap-1 text-sm sm:col-span-2">
              <span className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={row.isGameOnlyToken}
                  onChange={(e) => updateRow(row.key, { isGameOnlyToken: e.target.checked })}
                />
                ゲーム内でしか使用できない(ゲーム内の資産以外と交換不可)
              </span>
            </label>

            {!row.isGameOnlyToken && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-neutral-500">年始(1/1)保有数量</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={row.openingBalance}
                    onChange={(e) => updateRow(row.key, { openingBalance: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-neutral-500">年末(12/31)保有数量</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={row.closingBalance}
                    onChange={(e) => updateRow(row.key, { closingBalance: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-neutral-500">年中に購入した数量</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={row.purchasedAmount}
                    onChange={(e) => updateRow(row.key, { purchasedAmount: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col justify-end gap-1 text-sm">
                  <span className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                    <input
                      type="checkbox"
                      checked={row.hasYearEndMarketValue}
                      onChange={(e) =>
                        updateRow(row.key, { hasYearEndMarketValue: e.target.checked })
                      }
                    />
                    年末時点で時価を算定できる
                  </span>
                </label>
                {row.hasYearEndMarketValue && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-neutral-500">
                      年末の暗号資産への換算レート(1トークンあたり円)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={row.yearEndRate}
                      onChange={(e) => updateRow(row.key, { yearEndRate: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-neutral-500">
                    年中に暗号資産等へ交換した分の交換時の価額(円)
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={row.midYearCryptoExchangeValue}
                    onChange={(e) =>
                      updateRow(row.key, { midYearCryptoExchangeValue: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              </>
            )}

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
            setItems((prev) => [...prev, newTokenRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          ゲーム内通貨を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(すべて0以上の数値)。</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {result.items.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 p-3 text-sm sm:grid-cols-4 dark:border-neutral-800"
              >
                <p className="font-medium sm:col-span-4">
                  {item.description || `ゲーム内通貨 ${i + 1}`}
                  {!item.taxable && (
                    <span className="ml-2 text-xs text-neutral-500">
                      (ゲーム内限定トークンのため課税対象外)
                    </span>
                  )}
                </p>
                <p className="text-neutral-500">
                  年末一括評価分: {yen(item.yearEndValuationIncomeJpy)}
                </p>
                <p className="text-neutral-500">
                  年中交換分: {yen(item.midYearExchangeIncomeJpy)}
                </p>
                <p className="text-neutral-500 sm:col-span-2">
                  雑所得の金額: <span className="font-semibold">{yen(item.miscIncomeJpy)}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">雑所得の金額の合計</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.totalMiscIncomeJpy)}</p>
          </div>

          {result.totalMiscIncomeJpy.isNegative() && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              雑所得の金額が赤字({yen(result.totalMiscIncomeJpy.abs())})です。他の所得区分
              (給与所得等)との損益通算はできません(暗号資産等、雑所得内での通算のみ
              可能)。
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
