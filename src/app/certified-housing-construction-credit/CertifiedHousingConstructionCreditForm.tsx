"use client";

import { useMemo, useState } from "react";
import {
  deleteCertifiedHousingConstructionCreditRecord,
  saveCertifiedHousingConstructionCreditRecord,
} from "@/app/actions";
import {
  CERTIFIED_HOUSING_TYPE_LABEL,
  estimateCertifiedHousingConstructionCredit,
  type CertifiedHousingType,
} from "@/lib/certifiedHousingConstructionCredit";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function CertifiedHousingConstructionCreditForm({
  year,
  registeredCreditJpy,
}: {
  year: number;
  /** 登録済みの控除額(参考表示。未登録ならnull) */
  registeredCreditJpy: number | null;
}) {
  const [residenceYear, setResidenceYear] = useState(String(year));
  const [housingType, setHousingType] = useState<CertifiedHousingType>("CERTIFIED");
  const [floorAreaSqm, setFloorAreaSqm] = useState("100");
  const [totalIncomeJpy, setTotalIncomeJpy] = useState("0");
  const [isNewOrUnusedAcquisition, setIsNewOrUnusedAcquisition] = useState(true);
  const [occupiedWithinSixMonths, setOccupiedWithinSixMonths] = useState(true);
  const [atLeastHalfOwnResidence, setAtLeastHalfOwnResidence] = useState(true);
  const [isMainResidenceAmongMultipleHomes, setIsMainResidenceAmongMultipleHomes] =
    useState(true);
  const [usedHomeSaleCapitalGainsExclusion, setUsedHomeSaleCapitalGainsExclusion] =
    useState(false);
  const [choseMortgageDeductionInstead, setChoseMortgageDeductionInstead] = useState(false);

  const result = useMemo(() => {
    try {
      return estimateCertifiedHousingConstructionCredit({
        residenceYear: Number(residenceYear) || 0,
        housingType,
        floorAreaSqm: floorAreaSqm || 0,
        totalIncomeJpy: totalIncomeJpy || 0,
        isNewOrUnusedAcquisition,
        occupiedWithinSixMonths,
        atLeastHalfOwnResidence,
        isMainResidenceAmongMultipleHomes,
        usedHomeSaleCapitalGainsExclusion,
        choseMortgageDeductionInstead,
      });
    } catch {
      return null;
    }
  }, [
    residenceYear,
    housingType,
    floorAreaSqm,
    totalIncomeJpy,
    isNewOrUnusedAcquisition,
    occupiedWithinSixMonths,
    atLeastHalfOwnResidence,
    isMainResidenceAmongMultipleHomes,
    usedHomeSaleCapitalGainsExclusion,
    choseMortgageDeductionInstead,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">入力</legend>
        <Field
          label="居住を開始した年(令和4年=2022年〜令和10年=2028年)"
          value={residenceYear}
          onChange={setResidenceYear}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">住宅の区分</span>
          <select
            value={housingType}
            onChange={(e) => setHousingType(e.target.value as CertifiedHousingType)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(Object.keys(CERTIFIED_HOUSING_TYPE_LABEL) as CertifiedHousingType[]).map((t) => (
              <option key={t} value={t}>
                {CERTIFIED_HOUSING_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <Field label="床面積(平方メートル)" value={floorAreaSqm} onChange={setFloorAreaSqm} />
        <Field label="合計所得金額(円)" value={totalIncomeJpy} onChange={setTotalIncomeJpy} />
      </fieldset>

      <fieldset className="flex flex-wrap gap-4 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">要件の確認</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isNewOrUnusedAcquisition}
            onChange={(e) => setIsNewOrUnusedAcquisition(e.target.checked)}
          />
          新築、または建築後使用されたことのない住宅の取得である(中古住宅ではない)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={occupiedWithinSixMonths}
            onChange={(e) => setOccupiedWithinSixMonths(e.target.checked)}
          />
          新築または取得の日から6か月以内に居住している
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={atLeastHalfOwnResidence}
            onChange={(e) => setAtLeastHalfOwnResidence(e.target.checked)}
          />
          床面積の2分の1以上が自己の居住用部分である
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isMainResidenceAmongMultipleHomes}
            onChange={(e) => setIsMainResidenceAmongMultipleHomes(e.target.checked)}
          />
          複数の住宅を所有している場合、主として居住する住宅である(1つのみ所有の場合はチェックのまま)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={usedHomeSaleCapitalGainsExclusion}
            onChange={(e) => setUsedHomeSaleCapitalGainsExclusion(e.target.checked)}
          />
          居住年の前後合計6年間に居住用財産の譲渡所得の特例(3,000万円控除等)の適用を受けた
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={choseMortgageDeductionInstead}
            onChange={(e) => setChoseMortgageDeductionInstead(e.target.checked)}
          />
          同一の新築等について住宅ローン控除の適用を受ける(選択する)
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値)。</p>
      ) : !result.eligible ? (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          {result.ineligibleReason}
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-6 dark:border-white">
            <p className="text-sm text-neutral-500">
              認定住宅等新築等特別税額控除額(所得税分のみ・居住年分)
            </p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.creditJpy)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              標準的なかかり増し費用 {yen(result.incrementalCostJpy)} → 限度額適用後{" "}
              {yen(result.cappedCostJpy)} × 10%
            </p>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveCertifiedHousingConstructionCreditRecord}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="creditJpy" value={result.creditJpy.toString()} />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の認定住宅等新築等特別税額控除として登録する
              </button>
            </form>
            {registeredCreditJpy !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  登録済み({year}年分): {yen(registeredCreditJpy)}(/tax-estimateの初期値・
                  下書きCSVに反映)
                </p>
                <form action={deleteCertifiedHousingConstructionCreditRecord}>
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
