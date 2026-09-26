"use client";

import { useMemo, useState } from "react";
import { simulateLowUtilizationLandSaleDeduction } from "@/lib/realEstate/lowUtilizationLandSaleDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function LowUtilizationLandSaleDeductionForm() {
  const [transferPriceJpy, setTransferPriceJpy] = useState("");
  const [acquisitionCostJpy, setAcquisitionCostJpy] = useState("");
  const [transferExpensesJpy, setTransferExpensesJpy] = useState("");
  const [ownershipYears, setOwnershipYears] = useState("");
  const [inSpecialLowUtilizationArea, setInSpecialLowUtilizationArea] = useState(false);
  const [specialDeductionEligible, setSpecialDeductionEligible] = useState(true);
  const [useEstimatedAcquisitionCost, setUseEstimatedAcquisitionCost] = useState(false);

  const result = useMemo(() => {
    try {
      return simulateLowUtilizationLandSaleDeduction({
        transferPriceJpy: transferPriceJpy === "" ? 0 : transferPriceJpy,
        acquisitionCostJpy: acquisitionCostJpy === "" ? 0 : acquisitionCostJpy,
        transferExpensesJpy: transferExpensesJpy === "" ? 0 : transferExpensesJpy,
        ownershipYears: ownershipYears === "" ? 0 : Number(ownershipYears),
        inSpecialLowUtilizationArea,
        specialDeductionEligible,
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
    inSpecialLowUtilizationArea,
    specialDeductionEligible,
    useEstimatedAcquisitionCost,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="譲渡価額(建物等の対価を含む)"
          value={transferPriceJpy}
          onChange={setTransferPriceJpy}
        />
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
            checked={inSpecialLowUtilizationArea}
            onChange={(e) => setInSpecialLowUtilizationArea(e.target.checked)}
          />
          市街化区域・非線引き都市計画区域内の用途地域設定区域・所有者不明土地対策計画を
          策定した市区町村の区域内等に所在する(該当する場合、譲渡価額の上限が500万円から
          800万円に引き上げられる)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={specialDeductionEligible}
            onChange={(e) => setSpecialDeductionEligible(e.target.checked)}
          />
          低未利用土地等の100万円特別控除(措置法35条の3)のその他の要件(特別の関係が
          ある者への譲渡でないこと、都市計画区域内にあり譲渡後に利用されること、分筆履歴、
          他の特別控除との重複適用でないこと等)を満たす
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

          {result.priceLimitExceeded && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              譲渡価額が上限({yen(result.priceLimitJpy)})を超えるため、100万円特別控除は
              適用できない。
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="譲渡所得(特別控除前)" value={result.transferGainJpy} />
            <SummaryCard label="100万円特別控除の適用額" value={result.specialDeductionAppliedJpy} />
            <SummaryCard label="課税譲渡所得金額" value={result.taxableGainJpy} />
          </div>

          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">
              {result.holdingPeriodCategory === "LONG_TERM"
                ? "長期譲渡所得(税率合計20.315%)"
                : "短期譲渡所得(税率合計39.63%)"}
            </p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.totalTaxJpy)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              国税(所得税+復興特別所得税) {yen(result.nationalTaxJpy)} + 住民税 {yen(result.residentTaxJpy)}
            </p>
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
