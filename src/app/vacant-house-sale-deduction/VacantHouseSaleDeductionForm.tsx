"use client";

import { useMemo, useState } from "react";
import { simulateVacantHouseSaleTax } from "@/lib/realEstate/vacantHouseSaleTaxSimulation";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function VacantHouseSaleDeductionForm() {
  const [transferPriceJpy, setTransferPriceJpy] = useState("");
  const [acquisitionCostJpy, setAcquisitionCostJpy] = useState("");
  const [transferExpensesJpy, setTransferExpensesJpy] = useState("");
  const [heirCount, setHeirCount] = useState("1");
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(true);
  const [demolishedOrEarthquakeResistant, setDemolishedOrEarthquakeResistant] = useState(true);
  const [useEstimatedAcquisitionCost, setUseEstimatedAcquisitionCost] = useState(false);

  const result = useMemo(() => {
    try {
      return simulateVacantHouseSaleTax({
        transferPriceJpy: transferPriceJpy === "" ? 0 : transferPriceJpy,
        acquisitionCostJpy: acquisitionCostJpy === "" ? 0 : acquisitionCostJpy,
        transferExpensesJpy: transferExpensesJpy === "" ? 0 : transferExpensesJpy,
        heirCount: heirCount === "" ? 0 : Number(heirCount),
        eligibilityConfirmed,
        demolishedOrEarthquakeResistant,
        useEstimatedAcquisitionCost,
      });
    } catch {
      return null;
    }
  }, [
    transferPriceJpy,
    acquisitionCostJpy,
    transferExpensesJpy,
    heirCount,
    eligibilityConfirmed,
    demolishedOrEarthquakeResistant,
    useEstimatedAcquisitionCost,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="譲渡価額" value={transferPriceJpy} onChange={setTransferPriceJpy} />
        <Field label="取得費(被相続人から引き継いだ額)" value={acquisitionCostJpy} onChange={setAcquisitionCostJpy} />
        <Field
          label="譲渡費用(仲介手数料・印紙税・取壊し費用等)"
          value={transferExpensesJpy}
          onChange={setTransferExpensesJpy}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            相続又は遺贈によりこの家屋及び敷地等を取得した相続人の数
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={heirCount}
            onChange={(e) => setHeirCount(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={eligibilityConfirmed}
            onChange={(e) => setEligibilityConfirmed(e.target.checked)}
          />
          家屋の建築時期(昭和56年5月31日以前)・被相続人が相続開始直前まで一人で
          居住していたこと・相続開始から譲渡まで事業用・貸付用・居住用に供されて
          いないこと・特別の関係がある者への譲渡でないこと等、措置法35条3項の要件を
          満たす
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={demolishedOrEarthquakeResistant}
            onChange={(e) => setDemolishedOrEarthquakeResistant(e.target.checked)}
          />
          譲渡の日の属する年の翌年2月15日までに、耐震基準に適合することとなったか、
          家屋の全部の取壊し等を行った
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
          入力値を確認してください(譲渡価額・取得費・譲渡費用は0以上、相続人の数は
          1以上の整数)。
        </p>
      ) : (
        <>
          {result.transferPriceExceedsLimit && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              譲渡対価が1億円を超えているため、本特例の対象外(自動判定)。
            </p>
          )}

          {result.estimatedAcquisitionCostApplied && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              概算取得費の特例により、取得費として譲渡価額の5%相当額(
              {yen(result.estimatedAcquisitionCostJpy)})を採用した。
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="譲渡所得(特別控除前)" value={result.transferGainJpy} />
            <SummaryCard
              label={`特別控除の適用額(限度額${yen(result.specialDeductionLimitJpy)})`}
              value={result.specialDeductionAppliedJpy}
            />
            <SummaryCard label="課税譲渡所得金額" value={result.taxableGainJpy} />
          </div>

          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">
              長期譲渡所得(税率合計20.315%){result.eligible ? "・特例適用" : "・特例未適用"}
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
