"use client";

import { useMemo, useState } from "react";
import { simulateHomeSaleTax } from "@/lib/realEstate/homeSaleTaxSimulation";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function HomeSaleDeductionForm() {
  const [transferPriceJpy, setTransferPriceJpy] = useState("");
  const [acquisitionCostJpy, setAcquisitionCostJpy] = useState("");
  const [transferExpensesJpy, setTransferExpensesJpy] = useState("");
  const [ownershipYears, setOwnershipYears] = useState("");
  const [specialDeductionEligible, setSpecialDeductionEligible] = useState(true);
  const [reducedRateEligible, setReducedRateEligible] = useState(false);
  const [useEstimatedAcquisitionCost, setUseEstimatedAcquisitionCost] = useState(false);

  const result = useMemo(() => {
    try {
      return simulateHomeSaleTax({
        transferPriceJpy: transferPriceJpy === "" ? 0 : transferPriceJpy,
        acquisitionCostJpy: acquisitionCostJpy === "" ? 0 : acquisitionCostJpy,
        transferExpensesJpy: transferExpensesJpy === "" ? 0 : transferExpensesJpy,
        ownershipYears: ownershipYears === "" ? 0 : Number(ownershipYears),
        specialDeductionEligible,
        reducedRateEligible,
        useEstimatedAcquisitionCost,
      });
    } catch {
      return null;
    }
  }, [
    transferPriceJpy,
    acquisitionCostJpy,
    transferExpensesJpy,
    ownershipYears,
    specialDeductionEligible,
    reducedRateEligible,
    useEstimatedAcquisitionCost,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="譲渡価額" value={transferPriceJpy} onChange={setTransferPriceJpy} />
        <Field label="取得費" value={acquisitionCostJpy} onChange={setAcquisitionCostJpy} />
        <Field
          label="譲渡費用(仲介手数料・印紙税等)"
          value={transferExpensesJpy}
          onChange={setTransferExpensesJpy}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">所有期間(譲渡した年の1月1日時点・年)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={ownershipYears}
            onChange={(e) => setOwnershipYears(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={specialDeductionEligible}
            onChange={(e) => setSpecialDeductionEligible(e.target.checked)}
          />
          居住用財産の3,000万円特別控除(措置法35条)の要件を満たす
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={reducedRateEligible}
            onChange={(e) => setReducedRateEligible(e.target.checked)}
          />
          所有期間10年超の居住用財産の軽減税率の特例(措置法31条の3)の要件を満たす
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useEstimatedAcquisitionCost}
            onChange={(e) => setUseEstimatedAcquisitionCost(e.target.checked)}
          />
          取得費が不明、または譲渡価額の5%相当額を下回る場合、概算取得費の特例
          (措置法31条の4)を使う
        </label>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(譲渡価額・取得費・譲渡費用は0以上、所有期間は0以上の整数)。
        </p>
      ) : (
        <>
          {result.estimatedAcquisitionCostApplied && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              概算取得費の特例により、取得費として譲渡価額の5%相当額(
              {yen(result.estimatedAcquisitionCostJpy)})を採用した。
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="譲渡所得(特別控除前)" value={result.transferGainJpy} />
            <SummaryCard label="3,000万円特別控除の適用額" value={result.specialDeductionAppliedJpy} />
            <SummaryCard label="課税譲渡所得金額" value={result.taxableGainJpy} />
          </div>

          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="flex items-center justify-between text-sm text-neutral-500">
              <span>
                {result.holdingPeriodCategory === "LONG_TERM" ? "長期譲渡所得" : "短期譲渡所得"}
                {result.reducedRateApplied && "(軽減税率の特例適用)"}
              </span>
            </p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.totalTaxJpy)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              国税(所得税+復興特別所得税) {yen(result.nationalTaxJpy)} + 住民税 {yen(result.residentTaxJpy)}
            </p>
          </div>

          {result.portions.length > 1 && (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">区分</th>
                    <th className="px-3 py-2 font-medium">課税譲渡所得金額</th>
                    <th className="px-3 py-2 font-medium">国税</th>
                    <th className="px-3 py-2 font-medium">住民税</th>
                  </tr>
                </thead>
                <tbody>
                  {result.portions.map((p) => (
                    <tr key={p.label} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2">{p.label}</td>
                      <td className="px-3 py-2">{yen(p.taxableGainJpy)}</td>
                      <td className="px-3 py-2">{yen(p.nationalTaxJpy)}</td>
                      <td className="px-3 py-2">{yen(p.residentTaxJpy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

function SummaryCard({ label, value }: { label: string; value: { toString(): string } }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{yen(value)}</p>
    </div>
  );
}
