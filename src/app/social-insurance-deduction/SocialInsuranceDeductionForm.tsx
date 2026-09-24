"use client";

import { useMemo, useState } from "react";
import { deleteIncomeDeduction, saveIncomeDeduction } from "@/app/actions";
import { estimateSocialInsuranceDeduction } from "@/lib/socialInsuranceDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const FIELDS: Array<{
  key:
    | "nationalPension"
    | "nationalPensionFund"
    | "nationalPensionSupplementary"
    | "nationalHealthInsurance"
    | "lateStageElderlyMedicalInsurance"
    | "longTermCareInsurance"
    | "employeesPensionInsurance"
    | "employmentInsurance"
    | "other";
  label: string;
  helper?: string;
}> = [
  { key: "nationalPension", label: "国民年金保険料", helper: "追納分を含む" },
  { key: "nationalPensionFund", label: "国民年金基金の掛金" },
  { key: "nationalPensionSupplementary", label: "国民年金の付加保険料" },
  { key: "nationalHealthInsurance", label: "国民健康保険料(税)" },
  { key: "lateStageElderlyMedicalInsurance", label: "後期高齢者医療保険料" },
  { key: "longTermCareInsurance", label: "介護保険料" },
  {
    key: "employeesPensionInsurance",
    label: "厚生年金保険料",
    helper: "年末調整でカバーされない分のみ",
  },
  {
    key: "employmentInsurance",
    label: "雇用保険料",
    helper: "年末調整でカバーされない分のみ",
  },
  { key: "other", label: "その他の社会保険料", helper: "任意継続被保険者の保険料等" },
];

type FormState = Record<(typeof FIELDS)[number]["key"], string>;

function initialState(): FormState {
  const state = {} as FormState;
  for (const field of FIELDS) {
    state[field.key] = "0";
  }
  return state;
}

export function SocialInsuranceDeductionForm({
  year,
  registeredDeductionJpy,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeductionJpy: number | null;
}) {
  const [values, setValues] = useState<FormState>(initialState);

  const result = useMemo(() => {
    try {
      return estimateSocialInsuranceDeduction({
        nationalPensionJpy: values.nationalPension || 0,
        nationalPensionFundJpy: values.nationalPensionFund || 0,
        nationalPensionSupplementaryJpy: values.nationalPensionSupplementary || 0,
        nationalHealthInsuranceJpy: values.nationalHealthInsurance || 0,
        lateStageElderlyMedicalInsuranceJpy: values.lateStageElderlyMedicalInsurance || 0,
        longTermCareInsuranceJpy: values.longTermCareInsurance || 0,
        employeesPensionInsuranceJpy: values.employeesPensionInsurance || 0,
        employmentInsuranceJpy: values.employmentInsurance || 0,
        otherJpy: values.other || 0,
      });
    } catch {
      return null;
    }
  }, [values]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">年間支払額</legend>
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">
              {field.label}
              {field.helper && <span className="ml-1 text-xs">({field.helper})</span>}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={values[field.key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
        ))}
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">社会保険料控除額(所得税・住民税共通)</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.deductionJpy)}</p>
            <form action={saveIncomeDeduction} className="mt-3">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="SOCIAL_INSURANCE" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={result.deductionJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={result.deductionJpy.toString()}
              />
              <input type="hidden" name="redirectPath" value="/social-insurance-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
              </button>
            </form>
            {registeredDeductionJpy !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  登録済み: {yen(registeredDeductionJpy)}(/tax-estimateの初期値に反映)
                </p>
                <form action={deleteIncomeDeduction}>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="type" value="SOCIAL_INSURANCE" />
                  <input type="hidden" name="redirectPath" value="/social-insurance-deduction" />
                  <button
                    type="submit"
                    className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400"
                  >
                    登録を削除する
                  </button>
                </form>
              </div>
            )}
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
