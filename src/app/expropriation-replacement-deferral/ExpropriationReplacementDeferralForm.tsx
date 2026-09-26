"use client";

import { useMemo, useState } from "react";
import { simulateExpropriationReplacementDeferral } from "@/lib/realEstate/expropriationReplacementDeferral";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function ExpropriationReplacementDeferralForm() {
  const [transferPriceJpy, setTransferPriceJpy] = useState("");
  const [acquisitionCostJpy, setAcquisitionCostJpy] = useState("");
  const [transferExpensesJpy, setTransferExpensesJpy] = useState("");
  const [replacementAssetAcquisitionCostJpy, setReplacementAssetAcquisitionCostJpy] = useState("");
  const [ownershipYears, setOwnershipYears] = useState("");
  const [deferralEligible, setDeferralEligible] = useState(true);
  const [useEstimatedAcquisitionCost, setUseEstimatedAcquisitionCost] = useState(false);

  const result = useMemo(() => {
    try {
      return simulateExpropriationReplacementDeferral({
        transferPriceJpy: transferPriceJpy === "" ? 0 : transferPriceJpy,
        acquisitionCostJpy: acquisitionCostJpy === "" ? 0 : acquisitionCostJpy,
        transferExpensesJpy: transferExpensesJpy === "" ? 0 : transferExpensesJpy,
        replacementAssetAcquisitionCostJpy:
          replacementAssetAcquisitionCostJpy === "" ? 0 : replacementAssetAcquisitionCostJpy,
        ownershipYears: ownershipYears === "" ? 0 : Number(ownershipYears),
        deferralEligible,
        useEstimatedAcquisitionCost,
      });
    } catch {
      return null;
    }
  }, [
    transferPriceJpy,
    acquisitionCostJpy,
    transferExpensesJpy,
    replacementAssetAcquisitionCostJpy,
    ownershipYears,
    deferralEligible,
    useEstimatedAcquisitionCost,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="譲渡価額(補償金・買取り代金)" value={transferPriceJpy} onChange={setTransferPriceJpy} />
        <Field label="取得費" value={acquisitionCostJpy} onChange={setAcquisitionCostJpy} />
        <Field
          label="譲渡費用(仲介手数料・印紙税等)"
          value={transferExpensesJpy}
          onChange={setTransferExpensesJpy}
        />
        <Field
          label="代替資産の取得価額(取得していない場合は0)"
          value={replacementAssetAcquisitionCostJpy}
          onChange={setReplacementAssetAcquisitionCostJpy}
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
            checked={deferralEligible}
            onChange={(e) => setDeferralEligible(e.target.checked)}
          />
          課税繰延べの特例(措置法33条・33条の2)の要件(代替資産の取得期限内の
          取得、代替資産の資産区分要件等)を満たす
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
          入力値を確認してください(譲渡価額・取得費・譲渡費用・代替資産の
          取得価額は0以上、所有期間は0以上の整数)。
        </p>
      ) : (
        <>
          {result.estimatedAcquisitionCostApplied && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              概算取得費の特例により、取得費として譲渡価額の5%相当額(
              {yen(result.estimatedAcquisitionCostJpy)})を採用した。
            </p>
          )}

          {result.fullyDeferred && (
            <p className="rounded-md border border-dashed border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              代替資産の取得価額が譲渡価額以上のため、譲渡が無かったものと
              みなされ課税は全額繰り延べられる。
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="譲渡所得(繰延べ前)" value={result.transferGainJpy} />
            <SummaryCard label="繰り延べられた譲渡益" value={result.deferredGainJpy} />
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

          <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <p className="text-neutral-500">
              代替資産を将来譲渡する際に引き継がれる取得価額(圧縮記帳後・参考値)
            </p>
            <p className="mt-1 text-lg font-semibold">
              {yen(result.replacementAssetCarryoverCostJpy)}
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
