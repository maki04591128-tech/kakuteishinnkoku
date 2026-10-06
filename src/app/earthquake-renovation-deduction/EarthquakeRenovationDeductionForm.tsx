"use client";

import { useMemo, useState } from "react";
import {
  deleteEarthquakeRenovationDeductionRecord,
  saveEarthquakeRenovationDeductionRecord,
} from "@/lib/earthquakeRenovationDeductionActions";
import { estimateEarthquakeRenovationDeduction } from "@/lib/earthquakeRenovationDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900";

export function EarthquakeRenovationDeductionForm({
  year,
  registeredCreditJpy,
}: {
  year: number;
  /** 登録済みの控除額(参考表示。未登録ならnull) */
  registeredCreditJpy: number | null;
}) {
  const [standardCostJpy, setStandardCostJpy] = useState("0");
  const [otherRelatedWorkCostJpy, setOtherRelatedWorkCostJpy] = useState("0");
  const [totalIncomeJpy, setTotalIncomeJpy] = useState("5000000");
  const [ownsHouse, setOwnsHouse] = useState(true);
  const [residenceIn2022Or2023, setResidenceIn2022Or2023] = useState(false);
  const [beforeReiwa4, setBeforeReiwa4] = useState(false);
  const [claimsMortgageDeductionForRelatedWork, setClaimsMortgageDeductionForRelatedWork] =
    useState(false);

  const result = useMemo(() => {
    try {
      return estimateEarthquakeRenovationDeduction({
        standardCostJpy: standardCostJpy || 0,
        otherRelatedWorkCostJpy: otherRelatedWorkCostJpy || 0,
        totalIncomeJpy: totalIncomeJpy || 0,
        ownsHouse,
        residenceIn2022Or2023,
        beforeReiwa4,
        claimsMortgageDeductionForRelatedWork,
      });
    } catch {
      return null;
    }
  }, [
    standardCostJpy,
    otherRelatedWorkCostJpy,
    totalIncomeJpy,
    ownsHouse,
    residenceIn2022Or2023,
    beforeReiwa4,
    claimsMortgageDeductionForRelatedWork,
  ]);

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
        <Field
          label="耐震工事と併せて行う増築・改築その他一定の工事の費用(円)"
          helper="無ければ0のまま"
          value={otherRelatedWorkCostJpy}
          onChange={setOtherRelatedWorkCostJpy}
        />
        <Field
          label="この特別控除を受ける年分の合計所得金額(円)"
          helper="Bの適用要件(2,000万円以下、経過措置は3,000万円以下)の判定に使用"
          value={totalIncomeJpy}
          onChange={setTotalIncomeJpy}
        />
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={ownsHouse} onChange={(e) => setOwnsHouse(e.target.checked)} />
          <span>自己が所有する家屋である</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={residenceIn2022Or2023}
            onChange={(e) => setResidenceIn2022Or2023(e.target.checked)}
          />
          <span>令和4年〜5年に居住の用に供した(Bの合計所得金額の上限が3,000万円になる経過措置)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={beforeReiwa4}
            onChange={(e) => setBeforeReiwa4(e.target.checked)}
          />
          <span>令和3年12月31日以前に耐震改修をした(Bは適用されずAのみになる)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={claimsMortgageDeductionForRelatedWork}
            onChange={(e) => setClaimsMortgageDeductionForRelatedWork(e.target.checked)}
          />
          <span>併せて行う増改築等について住宅借入金等特別控除も適用を受ける(Bは適用されずAのみになる)</span>
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-6 dark:border-white">
            <p className="text-sm text-neutral-500">住宅耐震改修特別控除額(所得税分のみ)</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.creditJpy)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              A: {yen(result.amountAJpy)}×10% + B: {yen(result.amountBJpy)}×5%
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
        className={inputClass}
      />
    </label>
  );
}
