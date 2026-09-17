"use client";

import { useMemo, useState } from "react";
import { saveIncomeDeduction } from "@/app/actions";
import { estimateMedicalExpenseDeduction } from "@/lib/medicalExpenseDeduction";
import {
  compareMedicalDeductionOptions,
  estimateSelfMedicationDeduction,
} from "@/lib/selfMedicationDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const RECOMMENDATION_LABEL: Record<string, string> = {
  MEDICAL_EXPENSE: "医療費控除",
  SELF_MEDICATION: "セルフメディケーション税制",
  EITHER: "どちらでも同額",
};

export function MedicalExpenseDeductionForm({
  year,
  defaultTotalIncomeJpy,
  registeredDeductionJpy,
  registeredSelfMedicationDeductionJpy,
}: {
  year: number;
  defaultTotalIncomeJpy: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの医療費控除額(未登録ならnull) */
  registeredDeductionJpy: number | null;
  /** 既にこの年分として登録済みのセルフメディケーション税制の控除額(未登録ならnull) */
  registeredSelfMedicationDeductionJpy: number | null;
}) {
  const [totalMedicalExpensesJpy, setTotalMedicalExpensesJpy] = useState("0");
  const [insuranceReimbursementJpy, setInsuranceReimbursementJpy] = useState("0");
  const [totalIncomeJpy, setTotalIncomeJpy] = useState(String(Math.round(defaultTotalIncomeJpy)));
  const [totalOtcDrugPurchasesJpy, setTotalOtcDrugPurchasesJpy] = useState("0");
  const [otcInsuranceReimbursementJpy, setOtcInsuranceReimbursementJpy] = useState("0");
  const [engagedInHealthInitiatives, setEngagedInHealthInitiatives] = useState(false);

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

  const selfMedicationResult = useMemo(() => {
    try {
      return estimateSelfMedicationDeduction({
        totalOtcDrugPurchasesJpy:
          totalOtcDrugPurchasesJpy === "" ? 0 : totalOtcDrugPurchasesJpy,
        insuranceReimbursementJpy:
          otcInsuranceReimbursementJpy === "" ? 0 : otcInsuranceReimbursementJpy,
        engagedInHealthInitiatives,
      });
    } catch {
      return null;
    }
  }, [totalOtcDrugPurchasesJpy, otcInsuranceReimbursementJpy, engagedInHealthInitiatives]);

  const comparison = useMemo(() => {
    if (result === null || selfMedicationResult === null) return null;
    return compareMedicalDeductionOptions(result.deductionJpy, selfMedicationResult.deductionJpy);
  }, [result, selfMedicationResult]);

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

      <hr className="border-neutral-200 dark:border-neutral-800" />

      <div>
        <h2 className="text-lg font-semibold">
          セルフメディケーション税制との比較(選択制のため併用不可)
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          特定一般用医薬品等(スイッチOTC医薬品等)の購入費から、選択制で医療費控除の
          代わりに使えるセルフメディケーション税制の控除額を試算し、どちらが有利かを比較する。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label="特定一般用医薬品等(スイッチOTC医薬品等)購入費の合計額"
          value={totalOtcDrugPurchasesJpy}
          onChange={setTotalOtcDrugPurchasesJpy}
        />
        <Field
          label="保険金等で補填される金額"
          value={otcInsuranceReimbursementJpy}
          onChange={setOtcInsuranceReimbursementJpy}
        />
        <label className="flex flex-col justify-end gap-1 text-sm">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={engagedInHealthInitiatives}
              onChange={(e) => setEngagedInHealthInitiatives(e.target.checked)}
            />
            <span className="text-neutral-500">
              健康の保持増進及び疾病の予防への一定の取組(健康診断・予防接種等)を行っている
            </span>
          </span>
        </label>
      </div>

      {selfMedicationResult === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">セルフメディケーション税制の控除額</p>
            <p className="mt-1 text-3xl font-semibold">
              {yen(selfMedicationResult.deductionJpy)}
            </p>
            <form action={saveIncomeDeduction} className="mt-3">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="SELF_MEDICATION" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={selfMedicationResult.deductionJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={selfMedicationResult.deductionJpy.toString()}
              />
              <input type="hidden" name="redirectPath" value="/medical-expense-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
              </button>
            </form>
            {registeredSelfMedicationDeductionJpy !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み: {yen(registeredSelfMedicationDeductionJpy)}(/tax-estimateの初期値に反映)
              </p>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <DetailItem
              label="差引金額(購入費 − 保険金等)"
              value={yen(selfMedicationResult.netOtcDrugPurchasesJpy)}
            />
            <DetailItem label="足切り額(定額)" value={yen(selfMedicationResult.thresholdJpy)} />
          </dl>

          <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
            {selfMedicationResult.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      )}

      {comparison !== null && (
        <div className="rounded-lg border-2 border-neutral-900 p-4 dark:border-white">
          <p className="text-sm text-neutral-500">比較結果</p>
          {comparison.recommended === "EITHER" ? (
            <p className="mt-1 text-lg font-semibold">
              どちらも{yen(comparison.medicalExpenseDeductionJpy)}で同額(0円の場合を含む)
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold">
              {RECOMMENDATION_LABEL[comparison.recommended]}の方が
              {yen(comparison.advantageJpy)}有利
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            医療費控除 {yen(comparison.medicalExpenseDeductionJpy)} / セルフメディケーション税制{" "}
            {yen(comparison.selfMedicationDeductionJpy)}。両制度は選択制で併用できないため、
            確定申告では有利な方のみを選んで登録すること(両方登録した場合、
            `/tax-estimate`の合計額には有利な方のみが反映される)。
          </p>
        </div>
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
