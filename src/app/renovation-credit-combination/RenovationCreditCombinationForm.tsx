"use client";

import { useMemo, useState } from "react";
import {
  combineRenovationCredits,
  type RenovationCreditCategory,
} from "@/lib/renovationCreditCombination";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900";

const CATEGORY_OPTIONS: { value: RenovationCreditCategory; label: string; href: string }[] = [
  { value: "EARTHQUAKE", label: "住宅耐震改修", href: "/earthquake-renovation-deduction" },
  { value: "BARRIER_FREE", label: "バリアフリー改修", href: "/barrier-free-renovation-deduction" },
  { value: "ENERGY_SAVING", label: "省エネ改修", href: "/energy-saving-renovation-deduction" },
  {
    value: "MULTI_HOUSEHOLD",
    label: "多世帯同居改修",
    href: "/multi-household-renovation-deduction",
  },
  {
    value: "DURABILITY_IMPROVEMENT",
    label: "耐久性向上改修",
    href: "/durability-improvement-renovation-deduction",
  },
  { value: "CHILD_REARING", label: "子育て対応改修", href: "/child-rearing-renovation-deduction" },
];

interface CategoryRowState {
  enabled: boolean;
  standardCostJpy: string;
  amountAJpy: string;
  otherRelatedWorkCostJpy: string;
}

function defaultRow(enabled: boolean): CategoryRowState {
  return { enabled, standardCostJpy: "0", amountAJpy: "0", otherRelatedWorkCostJpy: "0" };
}

export function RenovationCreditCombinationForm() {
  const [rows, setRows] = useState<Record<RenovationCreditCategory, CategoryRowState>>({
    EARTHQUAKE: defaultRow(false),
    BARRIER_FREE: defaultRow(true),
    ENERGY_SAVING: defaultRow(true),
    MULTI_HOUSEHOLD: defaultRow(false),
    DURABILITY_IMPROVEMENT: defaultRow(false),
    CHILD_REARING: defaultRow(false),
  });

  function updateRow(category: RenovationCreditCategory, patch: Partial<CategoryRowState>): void {
    setRows((prev) => ({ ...prev, [category]: { ...prev[category], ...patch } }));
  }

  const enabledCategories = CATEGORY_OPTIONS.filter((c) => rows[c.value].enabled);

  const result = useMemo(() => {
    try {
      if (enabledCategories.length === 0) return null;
      return combineRenovationCredits({
        categories: enabledCategories.map((c) => {
          const row = rows[c.value];
          return {
            category: c.value,
            standardCostJpy: row.standardCostJpy || 0,
            amountAJpy: row.amountAJpy || 0,
            otherRelatedWorkCostJpy: row.otherRelatedWorkCostJpy || 0,
          };
        }),
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">併せて行った改修工事</legend>
        {CATEGORY_OPTIONS.map((option) => {
          const row = rows[option.value];
          return (
            <div
              key={option.value}
              className="grid grid-cols-1 gap-3 border-b border-dashed border-neutral-200 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-4 dark:border-neutral-800"
            >
              <label className="flex items-center gap-2 text-sm font-medium sm:col-span-4">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => updateRow(option.value, { enabled: e.target.checked })}
                />
                <span>{option.label}</span>
                <a
                  href={option.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-normal text-neutral-500 underline"
                >
                  単体の試算画面を開く
                </a>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-500">標準的な費用の額(standardCostJpy)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  disabled={!row.enabled}
                  value={row.standardCostJpy}
                  onChange={(e) => updateRow(option.value, { standardCostJpy: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-500">A(控除対象限度額までの部分。amountAJpy)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  disabled={!row.enabled}
                  value={row.amountAJpy}
                  onChange={(e) => updateRow(option.value, { amountAJpy: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-500">併せて行う増改築等工事費用の額</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  disabled={!row.enabled}
                  value={row.otherRelatedWorkCostJpy}
                  onChange={(e) =>
                    updateRow(option.value, { otherRelatedWorkCostJpy: e.target.value })
                  }
                  className={inputClass}
                />
              </label>
            </div>
          );
        })}
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">
          少なくとも1つの改修工事を選択し、入力値を確認してください(金額は0以上、Aは標準的な
          費用の額以下、同じ種類の改修工事の重複が無いか確認すること)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">Aの合計額</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalAJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">Bの限度額(1,000万円-Aの合計額)</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.combinedBLimitJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">併用後のB</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.combinedBJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">控除額の合計(A分+B分)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalCreditJpy)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="p-2">改修工事</th>
                  <th className="p-2">標準的な費用の額</th>
                  <th className="p-2">A</th>
                  <th className="p-2">超過分</th>
                  <th className="p-2">関連工事費用</th>
                  <th className="p-2">Aの控除額</th>
                </tr>
              </thead>
              <tbody>
                {result.categories.map((c) => {
                  const label = CATEGORY_OPTIONS.find((o) => o.value === c.category)?.label;
                  return (
                    <tr key={c.category} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="p-2">{label}</td>
                      <td className="p-2">{yen(c.standardCostJpy)}</td>
                      <td className="p-2">{yen(c.amountAJpy)}</td>
                      <td className="p-2">{yen(c.excessOverControlLimitJpy)}</td>
                      <td className="p-2">{yen(c.otherRelatedWorkCostJpy)}</td>
                      <td className="p-2">{yen(c.aCreditJpy)}</td>
                    </tr>
                  );
                })}
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
