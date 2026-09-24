"use client";

import { useMemo, useState } from "react";
import {
  estimateRetirementIncome,
  type RetirementIncomeCategory,
} from "@/lib/retirementIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const CATEGORY_LABELS: Record<RetirementIncomeCategory, string> = {
  GENERAL: "一般の退職手当等(通常どおり2分の1課税)",
  SPECIFIED_OFFICER: "特定役員退職手当等(役員等勤続年数5年以下。2分の1課税の適用なし)",
  SHORT_TERM: "短期退職手当等(役員等以外の勤続年数5年以下。300万円超の部分のみ2分の1課税の適用なし)",
};

export function RetirementIncomeForm() {
  const [incomeJpy, setIncomeJpy] = useState("0");
  const [yearsOfService, setYearsOfService] = useState("10");
  const [isDisabilityRelated, setIsDisabilityRelated] = useState(false);
  const [category, setCategory] = useState<RetirementIncomeCategory>("GENERAL");

  const result = useMemo(() => {
    const years = Number(yearsOfService);
    if (!Number.isFinite(years) || years <= 0) return null;
    try {
      return estimateRetirementIncome({
        incomeJpy: incomeJpy === "" ? 0 : incomeJpy,
        yearsOfService: years,
        isDisabilityRelated,
        category,
      });
    } catch {
      return null;
    }
  }, [incomeJpy, yearsOfService, isDisabilityRelated, category]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">退職金の収入金額(源泉徴収前)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={incomeJpy}
            onChange={(e) => setIncomeJpy(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            勤続年数(1年未満は切り上げ計算。例: 10年3か月→10.25)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={yearsOfService}
            onChange={(e) => setYearsOfService(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-neutral-500">区分</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as RetirementIncomeCategory)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(Object.keys(CATEGORY_LABELS) as RetirementIncomeCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isDisabilityRelated}
            onChange={(e) => setIsDisabilityRelated(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span className="text-neutral-500">
            障害者になったことが直接の原因で退職した(退職所得控除額に100万円加算)
          </span>
        </label>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(収入金額は0以上、勤続年数は0より大きい数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">退職所得控除額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.deductionJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">退職所得の金額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.retirementIncomeJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">所得税額(復興特別所得税を含む)の目安</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.nationalTaxJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">住民税額の目安</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.residentTaxJpy)}</p>
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
