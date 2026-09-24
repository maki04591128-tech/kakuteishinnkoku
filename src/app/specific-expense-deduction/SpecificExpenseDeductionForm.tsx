"use client";

import { useMemo, useState } from "react";
import { deleteIncomeDeduction, saveIncomeDeduction } from "@/app/actions";
import { estimateSpecificExpenseDeduction } from "@/lib/specificExpenseDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function SpecificExpenseDeductionForm({
  year,
  registeredDeduction,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
}) {
  const [salaryIncome, setSalaryIncome] = useState("0");
  const [commutingExpense, setCommutingExpense] = useState("0");
  const [relocationExpense, setRelocationExpense] = useState("0");
  const [trainingExpense, setTrainingExpense] = useState("0");
  const [qualificationExpense, setQualificationExpense] = useState("0");
  const [returningHomeExpense, setReturningHomeExpense] = useState("0");
  const [jobRelatedExpense, setJobRelatedExpense] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateSpecificExpenseDeduction({
        year,
        salaryIncomeJpy: salaryIncome === "" ? 0 : salaryIncome,
        commutingExpenseJpy: commutingExpense === "" ? 0 : commutingExpense,
        relocationExpenseJpy: relocationExpense === "" ? 0 : relocationExpense,
        trainingExpenseJpy: trainingExpense === "" ? 0 : trainingExpense,
        qualificationExpenseJpy: qualificationExpense === "" ? 0 : qualificationExpense,
        returningHomeExpenseJpy: returningHomeExpense === "" ? 0 : returningHomeExpense,
        jobRelatedExpenseJpy: jobRelatedExpense === "" ? 0 : jobRelatedExpense,
      });
    } catch {
      return null;
    }
  }, [
    year,
    salaryIncome,
    commutingExpense,
    relocationExpense,
    trainingExpense,
    qualificationExpense,
    returningHomeExpense,
    jobRelatedExpense,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <Field label="給与収入金額" value={salaryIncome} onChange={setSalaryIncome} />
        <Field label="通勤費" value={commutingExpense} onChange={setCommutingExpense} />
        <Field
          label="転居費(転勤に伴うもの)"
          value={relocationExpense}
          onChange={setRelocationExpense}
        />
        <Field label="研修費" value={trainingExpense} onChange={setTrainingExpense} />
        <Field
          label="資格取得費"
          value={qualificationExpense}
          onChange={setQualificationExpense}
        />
        <Field
          label="単身赴任者の帰宅旅費"
          value={returningHomeExpense}
          onChange={setReturningHomeExpense}
        />
        <Field
          label="勤務必要経費(図書費・衣服費・交際費等。年間65万円が上限)"
          value={jobRelatedExpense}
          onChange={setJobRelatedExpense}
        />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">特定支出控除額</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.specificExpenseDeductionJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">特定支出控除適用後の給与所得金額</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.adjustedEmploymentIncomeJpy)}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveIncomeDeduction}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="SPECIFIC_EXPENSE" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={result.specificExpenseDeductionJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={result.specificExpenseDeductionJpy.toString()}
              />
              <input type="hidden" name="redirectPath" value="/specific-expense-deduction" />
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
                  <input type="hidden" name="type" value="SPECIFIC_EXPENSE" />
                  <input type="hidden" name="redirectPath" value="/specific-expense-deduction" />
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
              label="給与所得控除額"
              value={yen(result.employmentIncomeDeductionJpy)}
            />
            <DetailItem
              label="適用判定基準額(給与所得控除額の1/2)"
              value={yen(result.thresholdJpy)}
            />
            <DetailItem
              label="特定支出の合計額(勤務必要経費は上限適用後)"
              value={yen(result.totalSpecificExpenseJpy)}
            />
            <DetailItem
              label="勤務必要経費(上限適用後)"
              value={yen(result.cappedJobRelatedExpenseJpy)}
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
