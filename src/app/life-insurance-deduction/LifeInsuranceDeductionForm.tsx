"use client";

import { useMemo, useState } from "react";
import { saveIncomeDeduction } from "@/app/actions";
import { estimateLifeInsurancePremiumDeduction } from "@/lib/lifeInsuranceDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function LifeInsuranceDeductionForm({
  year,
  registeredDeduction,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
}) {
  const [generalNew, setGeneralNew] = useState("0");
  const [generalOld, setGeneralOld] = useState("0");
  const [medicalCareNew, setMedicalCareNew] = useState("0");
  const [pensionNew, setPensionNew] = useState("0");
  const [pensionOld, setPensionOld] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateLifeInsurancePremiumDeduction({
        general: {
          newPremiumJpy: generalNew === "" ? 0 : generalNew,
          oldPremiumJpy: generalOld === "" ? 0 : generalOld,
        },
        medicalCare: {
          newPremiumJpy: medicalCareNew === "" ? 0 : medicalCareNew,
        },
        individualPension: {
          newPremiumJpy: pensionNew === "" ? 0 : pensionNew,
          oldPremiumJpy: pensionOld === "" ? 0 : pensionOld,
        },
      });
    } catch {
      return null;
    }
  }, [generalNew, generalOld, medicalCareNew, pensionNew, pensionOld]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <CategoryFields
          title="一般生命保険料"
          newValue={generalNew}
          onNewChange={setGeneralNew}
          oldValue={generalOld}
          onOldChange={setGeneralOld}
        />
        <CategoryFields
          title="介護医療保険料"
          newValue={medicalCareNew}
          onNewChange={setMedicalCareNew}
        />
        <CategoryFields
          title="個人年金保険料"
          newValue={pensionNew}
          onNewChange={setPensionNew}
          oldValue={pensionOld}
          onOldChange={setPensionOld}
        />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">生命保険料控除額(所得税)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalIncomeTaxDeductionJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">生命保険料控除額(住民税)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalResidentTaxDeductionJpy)}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveIncomeDeduction}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="LIFE_INSURANCE" />
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
              <input type="hidden" name="redirectPath" value="/life-insurance-deduction" />
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

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <DetailItem
              label="一般生命保険料"
              value={`所得税 ${yen(result.general.incomeTaxDeductionJpy)} / 住民税 ${yen(result.general.residentTaxDeductionJpy)}`}
            />
            <DetailItem
              label="介護医療保険料"
              value={`所得税 ${yen(result.medicalCare.incomeTaxDeductionJpy)} / 住民税 ${yen(result.medicalCare.residentTaxDeductionJpy)}`}
            />
            <DetailItem
              label="個人年金保険料"
              value={`所得税 ${yen(result.individualPension.incomeTaxDeductionJpy)} / 住民税 ${yen(result.individualPension.residentTaxDeductionJpy)}`}
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

function CategoryFields({
  title,
  newValue,
  onNewChange,
  oldValue,
  onOldChange,
}: {
  title: string;
  newValue: string;
  onNewChange: (value: string) => void;
  oldValue?: string;
  onOldChange?: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="新制度(2012年1月1日以後の契約)の年間払込保険料"
          value={newValue}
          onChange={onNewChange}
        />
        {oldValue !== undefined && onOldChange !== undefined ? (
          <Field
            label="旧制度(2011年12月31日以前の契約)の年間払込保険料"
            value={oldValue}
            onChange={onOldChange}
          />
        ) : (
          <p className="flex items-end pb-1.5 text-xs text-neutral-500">
            旧制度にはこの区分が存在しないため入力欄なし
          </p>
        )}
      </div>
    </fieldset>
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
