"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  estimateTokenServiceCompensationIncome,
  type TokenServiceContractType,
} from "@/lib/tokenServiceCompensationIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface TokenServiceRow {
  key: string;
  description: string;
  contractType: TokenServiceContractType;
  tokenFairValue: string;
  fairValueDifficultToDetermine: boolean;
  contractualServiceValue: string;
  necessaryExpenses: string;
}

function newRow(key: string): TokenServiceRow {
  return {
    key,
    description: "",
    contractType: "CONTRACT",
    tokenFairValue: "0",
    fairValueDifficultToDetermine: false,
    contractualServiceValue: "0",
    necessaryExpenses: "0",
  };
}

export function TokenServiceIncomeForm() {
  const idPrefix = useId();
  const [items, setItems] = useState<TokenServiceRow[]>([newRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return estimateTokenServiceCompensationIncome({
        items: items.map((row) => ({
          description: row.description,
          contractType: row.contractType,
          tokenFairValueJpy: row.tokenFairValue || 0,
          fairValueDifficultToDetermine: row.fairValueDifficultToDetermine,
          contractualServiceValueJpy: row.contractualServiceValue || 0,
          necessaryExpensesJpy: row.necessaryExpenses || 0,
        })),
      });
    } catch {
      return null;
    }
  }, [items]);

  function updateRow(key: string, patch: Partial<TokenServiceRow>) {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {items.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-3 lg:grid-cols-6 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">トークン報酬 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">取引先・役務提供の内容</span>
              <input
                type="text"
                placeholder="業務委託先A等"
                value={row.description}
                onChange={(e) => updateRow(row.key, { description: e.target.value })}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">契約の類型</span>
              <select
                value={row.contractType}
                onChange={(e) =>
                  updateRow(row.key, {
                    contractType: e.target.value as TokenServiceContractType,
                  })
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="CONTRACT">請負契約等(事業所得又は雑所得)</option>
                <option value="EMPLOYMENT">雇用契約等(給与所得)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">トークンの時価</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.tokenFairValue}
                onChange={(e) => updateRow(row.key, { tokenFairValue: e.target.value })}
                disabled={row.fairValueDifficultToDetermine}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.fairValueDifficultToDetermine}
                onChange={(e) =>
                  updateRow(row.key, { fairValueDifficultToDetermine: e.target.checked })
                }
              />
              <span className="text-neutral-500">
                時価の算定が困難(契約などで定めた対価の額を使う)
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">契約などによって定めた対価の額</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.contractualServiceValue}
                onChange={(e) =>
                  updateRow(row.key, { contractualServiceValue: e.target.value })
                }
                disabled={!row.fairValueDifficultToDetermine}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">
                必要経費(請負契約等の場合のみ。給与所得は給与所得控除が別途適用)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.necessaryExpenses}
                onChange={(e) => updateRow(row.key, { necessaryExpenses: e.target.value })}
                disabled={row.contractType !== "CONTRACT"}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
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
            setItems((prev) => [...prev, newRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          トークン報酬を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(すべて0以上の数値)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">請負契約等分の収入合計</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.businessOrMiscRevenueJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">請負契約等分の必要経費合計</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.businessOrMiscExpensesJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">事業所得又は雑所得の金額</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.businessOrMiscIncomeJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">
                雇用契約等分の対価の額合計(給与所得控除前)
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.additionalEmploymentRevenueJpy)}
              </p>
            </div>
          </div>

          {result.businessOrMiscIncomeJpy.isNegative() && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              事業所得又は雑所得の金額が赤字({yen(result.businessOrMiscIncomeJpy.abs())})
              です。雑所得の場合、他の所得区分(給与所得等)との損益通算はできません
              (暗号資産等、雑所得内での通算のみ可能)。
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
