"use client";

import { useMemo, useState } from "react";
import { deleteIncomeDeduction, saveIncomeDeduction } from "@/app/actions";
import {
  estimateDisabilityDeduction,
  type DisabilityCategory,
} from "@/lib/disabilityDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function DisabilityDeductionForm({
  year,
  registeredDeduction,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
}) {
  const [taxpayerCategory, setTaxpayerCategory] = useState<DisabilityCategory>("NONE");
  const [generalCount, setGeneralCount] = useState("0");
  const [specialCount, setSpecialCount] = useState("0");
  const [specialLivingTogetherCount, setSpecialLivingTogetherCount] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateDisabilityDeduction({
        taxpayerCategory,
        generalCount: Number(generalCount === "" ? 0 : generalCount),
        specialCount: Number(specialCount === "" ? 0 : specialCount),
        specialLivingTogetherCount: Number(
          specialLivingTogetherCount === "" ? 0 : specialLivingTogetherCount,
        ),
      });
    } catch {
      return null;
    }
  }, [taxpayerCategory, generalCount, specialCount, specialLivingTogetherCount]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">納税者本人の障害区分</span>
          <select
            value={taxpayerCategory}
            onChange={(e) => setTaxpayerCategory(e.target.value as DisabilityCategory)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="NONE">該当なし</option>
            <option value="GENERAL">障害者(一般)</option>
            <option value="SPECIAL">特別障害者</option>
          </select>
        </label>
        <Field
          label="同一生計配偶者・扶養親族のうち障害者(一般)の人数"
          value={generalCount}
          onChange={setGeneralCount}
        />
        <Field
          label="同一生計配偶者・扶養親族のうち特別障害者(同居していないもの)の人数"
          value={specialCount}
          onChange={setSpecialCount}
        />
        <Field
          label="同一生計配偶者・扶養親族のうち同居特別障害者の人数"
          value={specialLivingTogetherCount}
          onChange={setSpecialLivingTogetherCount}
        />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(人数は0以上の整数)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">障害者控除額(所得税)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalIncomeTaxDeductionJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">障害者控除額(住民税)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalResidentTaxDeductionJpy)}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveIncomeDeduction}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="DISABILITY" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={result.totalIncomeTaxDeductionJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={result.totalResidentTaxDeductionJpy.toString()}
              />
              <input type="hidden" name="redirectPath" value="/disability-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
              </button>
            </form>
            {registeredDeduction !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  登録済み: 所得税 {yen(registeredDeduction.incomeTaxAmountJpy)} / 住民税{" "}
                  {yen(registeredDeduction.residentTaxAmountJpy)}(/tax-estimateの初期値に反映)
                </p>
                <form action={deleteIncomeDeduction}>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="type" value="DISABILITY" />
                  <input type="hidden" name="redirectPath" value="/disability-deduction" />
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

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <DetailItem
              label="納税者本人分"
              value={`所得税 ${yen(result.taxpayerIncomeTaxDeductionJpy)} / 住民税 ${yen(result.taxpayerResidentTaxDeductionJpy)}`}
            />
            <DetailItem
              label="同一生計配偶者・扶養親族分"
              value={`所得税 ${yen(result.relativesIncomeTaxDeductionJpy)} / 住民税 ${yen(result.relativesResidentTaxDeductionJpy)}`}
            />
          </dl>

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
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
