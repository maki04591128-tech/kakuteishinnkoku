"use client";

import { useMemo, useState } from "react";
import {
  estimateResidentTaxAdjustmentDeduction,
  type DependentDeductionDiffCategory,
  type SpouseDeductionDiffCategory,
} from "@/lib/residentTaxAdjustmentDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

type SpouseSelection = "NONE" | SpouseDeductionDiffCategory;
type WidowSingleParentSelection = "NONE" | "WIDOW" | "SINGLE_PARENT_FATHER" | "SINGLE_PARENT_MOTHER";

const DEPENDENT_FIELDS: Array<{ category: DependentDeductionDiffCategory; label: string }> = [
  { category: "GENERAL", label: "一般の控除対象扶養親族" },
  { category: "SPECIFIED", label: "特定扶養親族(19〜22歳)" },
  { category: "ELDERLY_COHABITING", label: "老人扶養親族(同居老親等)" },
  { category: "ELDERLY_OTHER", label: "老人扶養親族(同居老親等以外)" },
];

export function ResidentTaxAdjustmentDeductionForm({ year }: { year: number }) {
  const [taxpayerTotalIncome, setTaxpayerTotalIncome] = useState("5000000");
  const [totalTaxableIncome, setTotalTaxableIncome] = useState("3000000");
  const [spouse, setSpouse] = useState<SpouseSelection>("NONE");
  const [dependentCounts, setDependentCounts] = useState<Record<DependentDeductionDiffCategory, string>>({
    GENERAL: "0",
    SPECIFIED: "0",
    ELDERLY_COHABITING: "0",
    ELDERLY_OTHER: "0",
  });
  const [disabilityTaxpayerCategory, setDisabilityTaxpayerCategory] = useState<
    "NONE" | "GENERAL" | "SPECIAL"
  >("NONE");
  const [disabilityGeneralCount, setDisabilityGeneralCount] = useState("0");
  const [disabilitySpecialCount, setDisabilitySpecialCount] = useState("0");
  const [disabilitySpecialLivingTogetherCount, setDisabilitySpecialLivingTogetherCount] = useState("0");
  const [widowSingleParent, setWidowSingleParent] = useState<WidowSingleParentSelection>("NONE");
  const [workingStudent, setWorkingStudent] = useState(false);

  const result = useMemo(() => {
    try {
      return estimateResidentTaxAdjustmentDeduction({
        personalDeductionDifference: {
          year,
          taxpayerTotalIncomeJpy: taxpayerTotalIncome || 0,
          spouse: spouse === "NONE" ? undefined : { category: spouse },
          dependents: Object.fromEntries(
            Object.entries(dependentCounts).map(([category, count]) => [category, Number(count || 0)]),
          ) as Record<DependentDeductionDiffCategory, number>,
          disability: {
            taxpayerCategory: disabilityTaxpayerCategory,
            generalCount: Number(disabilityGeneralCount || 0),
            specialCount: Number(disabilitySpecialCount || 0),
            specialLivingTogetherCount: Number(disabilitySpecialLivingTogetherCount || 0),
          },
          widowSingleParentCategory: widowSingleParent === "NONE" ? undefined : widowSingleParent,
          workingStudent,
        },
        totalTaxableIncomeJpy: totalTaxableIncome || 0,
      });
    } catch {
      return null;
    }
  }, [
    year,
    taxpayerTotalIncome,
    totalTaxableIncome,
    spouse,
    dependentCounts,
    disabilityTaxpayerCategory,
    disabilityGeneralCount,
    disabilitySpecialCount,
    disabilitySpecialLivingTogetherCount,
    widowSingleParent,
    workingStudent,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">所得金額</legend>
        <NumberField
          label="納税者本人のその年の合計所得金額"
          value={taxpayerTotalIncome}
          onChange={setTaxpayerTotalIncome}
        />
        <NumberField
          label="合計課税所得金額(課税総所得金額等の合計。所得控除適用後の金額)"
          value={totalTaxableIncome}
          onChange={setTotalTaxableIncome}
        />
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">配偶者控除(配偶者特別控除は対象外)</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">配偶者控除の区分</span>
          <select
            value={spouse}
            onChange={(e) => setSpouse(e.target.value as SpouseSelection)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="NONE">該当なし</option>
            <option value="GENERAL">配偶者控除(一般)</option>
            <option value="ELDERLY">配偶者控除(老人控除対象配偶者)</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">扶養控除(特定親族特別控除は対象外)</legend>
        {DEPENDENT_FIELDS.map(({ category, label }) => (
          <NumberField
            key={category}
            label={`${label}の人数`}
            value={dependentCounts[category]}
            onChange={(value) => setDependentCounts((prev) => ({ ...prev, [category]: value }))}
          />
        ))}
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">障害者控除</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">納税者本人の障害区分</span>
          <select
            value={disabilityTaxpayerCategory}
            onChange={(e) =>
              setDisabilityTaxpayerCategory(e.target.value as "NONE" | "GENERAL" | "SPECIAL")
            }
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="NONE">該当なし</option>
            <option value="GENERAL">障害者(一般)</option>
            <option value="SPECIAL">特別障害者</option>
          </select>
        </label>
        <NumberField
          label="同一生計配偶者・扶養親族のうち障害者(一般)の人数"
          value={disabilityGeneralCount}
          onChange={setDisabilityGeneralCount}
        />
        <NumberField
          label="同一生計配偶者・扶養親族のうち特別障害者(同居していないもの)の人数"
          value={disabilitySpecialCount}
          onChange={setDisabilitySpecialCount}
        />
        <NumberField
          label="同一生計配偶者・扶養親族のうち同居特別障害者の人数"
          value={disabilitySpecialLivingTogetherCount}
          onChange={setDisabilitySpecialLivingTogetherCount}
        />
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">寡婦控除・ひとり親控除・勤労学生控除</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">寡婦控除・ひとり親控除の区分</span>
          <select
            value={widowSingleParent}
            onChange={(e) => setWidowSingleParent(e.target.value as WidowSingleParentSelection)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="NONE">該当なし</option>
            <option value="WIDOW">寡婦控除</option>
            <option value="SINGLE_PARENT_FATHER">ひとり親控除(父)</option>
            <option value="SINGLE_PARENT_MOTHER">ひとり親控除(母)</option>
          </select>
          <span className="text-xs text-neutral-500">
            ひとり親控除は旧寡婦(夫)控除からの沿革により父母で人的控除額の差が異なる(父1万円・母5万円)。
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={workingStudent}
            onChange={(e) => setWorkingStudent(e.target.checked)}
            className="h-4 w-4"
          />
          <span>勤労学生控除に該当する</span>
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(所得金額は0以上、人数は0以上の整数)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">人的控除額の差の合計額</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.personalDeductionDifferenceTotalJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">調整控除額(住民税から控除)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.adjustmentDeductionJpy)}</p>
            </div>
          </div>

          {result.personalDeductionDifferenceBreakdown.length > 0 && (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {result.personalDeductionDifferenceBreakdown.map((item, i) => (
                <div key={i} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                  <p className="text-xs text-neutral-500">{item.label}</p>
                  <p className="mt-0.5 font-medium">{yen(item.diffJpy)}</p>
                </div>
              ))}
            </dl>
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}
