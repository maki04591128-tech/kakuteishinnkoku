"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteIncomeDeduction, saveIncomeDeduction } from "@/app/actions";
import { estimateIncomeAmountAdjustmentDeduction } from "@/lib/incomeAmountAdjustmentDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function IncomeAmountAdjustmentDeductionForm({
  year,
  registeredDeduction,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
}) {
  const [salaryIncome, setSalaryIncome] = useState("0");
  const [isTaxpayerSpecialDisability, setIsTaxpayerSpecialDisability] = useState(false);
  const [hasSpecialDisabilityDependentOrSpouse, setHasSpecialDisabilityDependentOrSpouse] =
    useState(false);
  const [hasDependentUnder23, setHasDependentUnder23] = useState(false);
  const [publicPensionMiscIncome, setPublicPensionMiscIncome] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateIncomeAmountAdjustmentDeduction({
        year,
        salaryIncomeJpy: salaryIncome === "" ? 0 : salaryIncome,
        isTaxpayerSpecialDisability,
        hasSpecialDisabilityDependentOrSpouse,
        hasDependentUnder23,
        publicPensionMiscIncomeJpy: publicPensionMiscIncome === "" ? 0 : publicPensionMiscIncome,
      });
    } catch {
      return null;
    }
  }, [
    year,
    salaryIncome,
    isTaxpayerSpecialDisability,
    hasSpecialDisabilityDependentOrSpouse,
    hasDependentUnder23,
    publicPensionMiscIncome,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <Field label="給与収入金額" value={salaryIncome} onChange={setSalaryIncome} />
        <Field
          label="公的年金等に係る雑所得の金額"
          value={publicPensionMiscIncome}
          onChange={setPublicPensionMiscIncome}
        />
        <p className="-mt-2 text-xs text-neutral-500">
          金額が分からない場合は
          <Link href="/public-pension-income" className="underline">
            公的年金等に係る雑所得の試算
          </Link>
          で年金の収入金額から計算できる。
        </p>
        <Checkbox
          label="納税者本人が特別障害者に該当する"
          checked={isTaxpayerSpecialDisability}
          onChange={setIsTaxpayerSpecialDisability}
        />
        <Checkbox
          label="特別障害者に該当する同一生計配偶者・扶養親族がいる"
          checked={hasSpecialDisabilityDependentOrSpouse}
          onChange={setHasSpecialDisabilityDependentOrSpouse}
        />
        <Checkbox
          label="年齢23歳未満の扶養親族がいる"
          checked={hasDependentUnder23}
          onChange={setHasDependentUnder23}
        />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">所得金額調整控除額(合計)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalDeductionJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">控除適用後の給与所得金額</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.adjustedEmploymentIncomeJpy)}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveIncomeDeduction}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="INCOME_AMOUNT_ADJUSTMENT" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={result.totalDeductionJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={result.totalDeductionJpy.toString()}
              />
              <input
                type="hidden"
                name="redirectPath"
                value="/income-amount-adjustment-deduction"
              />
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
                  <input type="hidden" name="type" value="INCOME_AMOUNT_ADJUSTMENT" />
                  <input
                    type="hidden"
                    name="redirectPath"
                    value="/income-amount-adjustment-deduction"
                  />
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
              label="①子育て・特別障害者等の所得金額調整控除"
              value={
                result.isEligibleForChildOrDisabilityAdjustment
                  ? yen(result.childOrDisabilityAdjustmentJpy)
                  : "対象外"
              }
            />
            <DetailItem
              label="②給与所得・年金雑所得双方がある者の所得金額調整控除"
              value={
                result.isEligibleForPensionAdjustment
                  ? yen(result.pensionAdjustmentJpy)
                  : "対象外"
              }
            />
            <DetailItem
              label="給与所得控除額"
              value={yen(result.employmentIncomeDeductionJpy)}
            />
            <DetailItem
              label="調整前の給与所得金額"
              value={yen(result.employmentIncomeBeforeAdjustmentJpy)}
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
      />
      <span>{label}</span>
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
