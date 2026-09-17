"use client";

import { useMemo, useState } from "react";
import {
  estimateSmallBusinessMutualAidDeduction,
  idecoParticipantCategoryLabel,
  type IdecoParticipantCategory,
} from "@/lib/smallBusinessMutualAidDeduction";

const IDECO_CATEGORIES: IdecoParticipantCategory[] = [
  "UNKNOWN",
  "SELF_EMPLOYED",
  "EMPLOYEE_NO_PENSION",
  "EMPLOYEE_DC_ONLY",
  "EMPLOYEE_WITH_DB",
  "PUBLIC_SERVANT",
  "DEPENDENT_SPOUSE",
];

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function SmallBusinessMutualAidDeductionForm() {
  const [idecoContribution, setIdecoContribution] = useState("0");
  const [idecoCategory, setIdecoCategory] = useState<IdecoParticipantCategory>("UNKNOWN");
  const [smallBusinessMutualAid, setSmallBusinessMutualAid] = useState("0");
  const [dependentMutualAid, setDependentMutualAid] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateSmallBusinessMutualAidDeduction({
        idecoContributionJpy: idecoContribution === "" ? 0 : idecoContribution,
        idecoParticipantCategory: idecoCategory,
        smallBusinessMutualAidJpy: smallBusinessMutualAid === "" ? 0 : smallBusinessMutualAid,
        dependentWithDisabilitiesMutualAidJpy:
          dependentMutualAid === "" ? 0 : dependentMutualAid,
      });
    } catch {
      return null;
    }
  }, [idecoContribution, idecoCategory, smallBusinessMutualAid, dependentMutualAid]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-sm font-medium">iDeCo(個人型確定拠出年金)</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="年間拠出額"
              value={idecoContribution}
              onChange={setIdecoContribution}
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">加入区分(拠出限度額の参考表示に使用)</span>
              <select
                value={idecoCategory}
                onChange={(e) => setIdecoCategory(e.target.value as IdecoParticipantCategory)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {IDECO_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {idecoParticipantCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-sm font-medium">小規模企業共済</legend>
          <Field
            label="年間掛金額"
            value={smallBusinessMutualAid}
            onChange={setSmallBusinessMutualAid}
          />
        </fieldset>
        <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-sm font-medium">心身障害者扶養共済</legend>
          <Field
            label="年間掛金額"
            value={dependentMutualAid}
            onChange={setDependentMutualAid}
          />
        </fieldset>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">小規模企業共済等掛金控除額(所得税・住民税共通)</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.deductionJpy)}</p>
          </div>

          {result.idecoAnnualLimitJpy !== null && (
            <div
              className={`rounded-md border p-3 text-sm ${
                result.idecoExceedsLimit
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              iDeCoの年間拠出限度額(参考): {yen(result.idecoAnnualLimitJpy)}
              {result.idecoExceedsLimit && " — 入力額が限度額を超えています"}
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

function Field({
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}
