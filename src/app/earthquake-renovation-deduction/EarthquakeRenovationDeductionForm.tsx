"use client";

import { useMemo, useState } from "react";
import {
  deleteEarthquakeRenovationDeductionRecord,
  saveEarthquakeRenovationDeductionRecord,
} from "@/app/actions";
import { estimateEarthquakeRenovationDeduction } from "@/lib/earthquakeRenovationDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function EarthquakeRenovationDeductionForm({
  year,
  registeredCreditJpy,
}: {
  year: number;
  /** 登録済みの控除額(参考表示。未登録ならnull) */
  registeredCreditJpy: number | null;
}) {
  const [standardCostJpy, setStandardCostJpy] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateEarthquakeRenovationDeduction({
        standardCostJpy: standardCostJpy || 0,
      });
    } catch {
      return null;
    }
  }, [standardCostJpy]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">入力</legend>
        <Field
          label="耐震改修に係る標準的な工事費用相当額(円)"
          helper="増改築等工事証明書に記載された、補助金等控除後の金額をそのまま入力"
          value={standardCostJpy}
          onChange={setStandardCostJpy}
        />
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-6 dark:border-white">
            <p className="text-sm text-neutral-500">住宅耐震改修特別控除額(所得税分のみ)</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.creditJpy)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              控除額の計算基準額 {yen(result.cappedStandardCostJpy)} × 10%
            </p>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveEarthquakeRenovationDeductionRecord}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="creditJpy" value={result.creditJpy.toString()} />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の住宅耐震改修特別控除として登録する
              </button>
            </form>
            {registeredCreditJpy !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  登録済み({year}年分): {yen(registeredCreditJpy)}(/tax-estimateの初期値・
                  下書きCSVに反映)
                </p>
                <form action={deleteEarthquakeRenovationDeductionRecord}>
                  <input type="hidden" name="year" value={year} />
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
