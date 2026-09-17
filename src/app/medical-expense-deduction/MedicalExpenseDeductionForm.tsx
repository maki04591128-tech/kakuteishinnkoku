"use client";

import { useMemo, useState } from "react";
import { saveIncomeDeduction } from "@/app/actions";
import { estimateMedicalExpenseDeduction } from "@/lib/medicalExpenseDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function MedicalExpenseDeductionForm({
  year,
  defaultTotalIncomeJpy,
  registeredDeductionJpy,
}: {
  year: number;
  defaultTotalIncomeJpy: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeductionJpy: number | null;
}) {
  const [totalMedicalExpensesJpy, setTotalMedicalExpensesJpy] = useState("0");
  const [insuranceReimbursementJpy, setInsuranceReimbursementJpy] = useState("0");
  const [totalIncomeJpy, setTotalIncomeJpy] = useState(String(Math.round(defaultTotalIncomeJpy)));

  const result = useMemo(() => {
    try {
      return estimateMedicalExpenseDeduction({
        totalMedicalExpensesJpy: totalMedicalExpensesJpy === "" ? 0 : totalMedicalExpensesJpy,
        insuranceReimbursementJpy:
          insuranceReimbursementJpy === "" ? 0 : insuranceReimbursementJpy,
        totalIncomeJpy: totalIncomeJpy === "" ? 0 : totalIncomeJpy,
      });
    } catch {
      return null;
    }
  }, [totalMedicalExpensesJpy, insuranceReimbursementJpy, totalIncomeJpy]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label="年間に支払った医療費の合計額"
          value={totalMedicalExpensesJpy}
          onChange={setTotalMedicalExpensesJpy}
        />
        <Field
          label="保険金等で補填される金額(入院給付金・高額療養費等)"
          value={insuranceReimbursementJpy}
          onChange={setInsuranceReimbursementJpy}
        />
        <Field
          label="総所得金額等(所得控除前の年間合計)"
          value={totalIncomeJpy}
          onChange={setTotalIncomeJpy}
        />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">医療費控除額</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.deductionJpy)}</p>
            <form action={saveIncomeDeduction} className="mt-3">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="MEDICAL_EXPENSE" />
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
              <input type="hidden" name="redirectPath" value="/medical-expense-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
              </button>
            </form>
            {registeredDeductionJpy !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み: {yen(registeredDeductionJpy)}(/tax-estimateの初期値に反映)
              </p>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <DetailItem
              label="差引金額(医療費 − 保険金等)"
              value={yen(result.netMedicalExpensesJpy)}
            />
            <DetailItem
              label="総所得金額等の5%相当額"
              value={yen(result.fivePercentOfIncomeJpy)}
            />
            <DetailItem label="足切り額(10万円と5%相当額の少ない方)" value={yen(result.thresholdJpy)} />
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
