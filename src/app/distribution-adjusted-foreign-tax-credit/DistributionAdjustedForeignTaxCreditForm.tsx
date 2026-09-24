"use client";

import { useMemo, useState } from "react";
import { saveDistributionAdjustedForeignTaxCreditRecord } from "@/app/actions";
import { estimateDistributionAdjustedForeignTaxCredit } from "@/lib/investment/distributionAdjustedForeignTaxCredit";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function DistributionAdjustedForeignTaxCreditForm({
  year,
  autoDistributionAdjustedForeignTaxJpy,
  registeredCreditJpy,
}: {
  year: number;
  /** `/import`で登録済みの配当・分配金取引から自動集計した分配時調整外国税相当額の初期値 */
  autoDistributionAdjustedForeignTaxJpy: string;
  /** 登録済みの控除額(参考表示。未登録ならnull) */
  registeredCreditJpy: number | null;
}) {
  const [distributionAdjustedForeignTaxJpy, setDistributionAdjustedForeignTaxJpy] = useState(
    autoDistributionAdjustedForeignTaxJpy,
  );
  const [nationalTaxBeforeCreditJpy, setNationalTaxBeforeCreditJpy] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateDistributionAdjustedForeignTaxCredit({
        distributionAdjustedForeignTaxJpy: distributionAdjustedForeignTaxJpy || 0,
        nationalTaxBeforeCreditJpy: nationalTaxBeforeCreditJpy || 0,
      });
    } catch {
      return null;
    }
  }, [distributionAdjustedForeignTaxJpy, nationalTaxBeforeCreditJpy]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">入力</legend>
        <Field
          label="分配時調整外国税相当額(円)"
          helper="特定口座年間取引報告書等の記載額。初期値は登録済みの配当・分配金取引から自動集計"
          value={distributionAdjustedForeignTaxJpy}
          onChange={setDistributionAdjustedForeignTaxJpy}
        />
        <Field
          label="控除適用前の所得税額(円・復興特別所得税を含む)"
          helper="外国税額控除適用後の金額。/tax-estimateの試算結果を参考に入力"
          value={nationalTaxBeforeCreditJpy}
          onChange={setNationalTaxBeforeCreditJpy}
        />
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-6 dark:border-white">
            <p className="text-sm text-neutral-500">分配時調整外国税相当額控除額</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.creditJpy)}</p>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveDistributionAdjustedForeignTaxCreditRecord}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="creditJpy" value={result.creditJpy.toString()} />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の分配時調整外国税相当額控除として登録する
              </button>
            </form>
            {registeredCreditJpy !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み({year}年分): {yen(registeredCreditJpy)}(/tax-estimateの初期値・
                下書きCSVに反映)
              </p>
            )}
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
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">
        {label}
        {helper && <span className="ml-1 text-xs">({helper})</span>}
      </span>
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
