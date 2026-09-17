"use client";

import { useMemo, useState } from "react";
import { saveIncomeDeduction } from "@/app/actions";
import { estimateEarthquakeInsuranceDeduction } from "@/lib/earthquakeInsuranceDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function EarthquakeInsuranceDeductionForm({
  year,
  registeredDeduction,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
}) {
  const [earthquakePremium, setEarthquakePremium] = useState("0");
  const [oldLongTermPremium, setOldLongTermPremium] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateEarthquakeInsuranceDeduction({
        earthquakePremiumJpy: earthquakePremium === "" ? 0 : earthquakePremium,
        oldLongTermPremiumJpy: oldLongTermPremium === "" ? 0 : oldLongTermPremium,
      });
    } catch {
      return null;
    }
  }, [earthquakePremium, oldLongTermPremium]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <Field
          label="地震保険料(年間払込保険料)"
          value={earthquakePremium}
          onChange={setEarthquakePremium}
        />
        <Field
          label="旧長期損害保険料(経過措置対象契約の年間払込保険料)"
          value={oldLongTermPremium}
          onChange={setOldLongTermPremium}
        />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">地震保険料控除額(所得税)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalIncomeTaxDeductionJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">地震保険料控除額(住民税)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalResidentTaxDeductionJpy)}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveIncomeDeduction}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="EARTHQUAKE_INSURANCE" />
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
              <input type="hidden" name="redirectPath" value="/earthquake-insurance-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
              </button>
            </form>
            {registeredDeduction !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み: 所得税 {yen(registeredDeduction.incomeTaxAmountJpy)} / 住民税{" "}
                {yen(registeredDeduction.residentTaxAmountJpy)}(/tax-estimateの初期値に反映)
              </p>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <DetailItem
              label="地震保険料"
              value={`所得税 ${yen(result.earthquakeIncomeTaxDeductionJpy)} / 住民税 ${yen(result.earthquakeResidentTaxDeductionJpy)}`}
            />
            <DetailItem
              label="旧長期損害保険料"
              value={`所得税 ${yen(result.oldLongTermIncomeTaxDeductionJpy)} / 住民税 ${yen(result.oldLongTermResidentTaxDeductionJpy)}`}
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
