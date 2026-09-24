"use client";

import { useMemo, useState } from "react";
import {
  deleteBarrierFreeRenovationDeductionRecord,
  saveBarrierFreeRenovationDeductionRecord,
} from "@/app/actions";
import {
  estimateBarrierFreeRenovationDeduction,
  type BarrierFreeRenovationFloorAreaCategory,
  type BarrierFreeRenovationQualifyingPersonCategory,
} from "@/lib/barrierFreeRenovationDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const FLOOR_AREA_CATEGORY_LABEL: Record<BarrierFreeRenovationFloorAreaCategory, string> = {
  AT_LEAST_50: "50平方メートル以上",
  FROM_40_TO_50: "40平方メートル以上50平方メートル未満(令和8年以後の居住のみ)",
};

const QUALIFYING_PERSON_LABEL: Record<BarrierFreeRenovationQualifyingPersonCategory, string> = {
  NONE: "いずれにも該当しない",
  AGE_50_OR_OLDER: "50歳以上",
  CARE_OR_SUPPORT_CERTIFIED: "介護保険法上の要介護または要支援の認定を受けている",
  DISABLED: "所得税法上の障害者である",
  LIVING_WITH_ELDERLY_OR_CERTIFIED_RELATIVE:
    "高齢者等(65歳以上、または要介護・要支援の認定を受けた、もしくは障害者である親族)と同居を常況としている",
};

export function BarrierFreeRenovationDeductionForm({
  year,
  registeredCreditJpy,
}: {
  year: number;
  /** 登録済みの控除額(参考表示。未登録ならnull) */
  registeredCreditJpy: number | null;
}) {
  const [residenceYear, setResidenceYear] = useState(String(year));
  const [floorAreaCategory, setFloorAreaCategory] =
    useState<BarrierFreeRenovationFloorAreaCategory>("AT_LEAST_50");
  const [totalIncomeJpy, setTotalIncomeJpy] = useState("0");
  const [qualifyingPersonCategory, setQualifyingPersonCategory] =
    useState<BarrierFreeRenovationQualifyingPersonCategory>("AGE_50_OR_OLDER");
  const [standardCostJpy, setStandardCostJpy] = useState("0");
  const [otherRelatedWorkCostJpy, setOtherRelatedWorkCostJpy] = useState("0");
  const [workCompletedWithinSixMonths, setWorkCompletedWithinSixMonths] = useState(true);
  const [atLeastHalfCostForOwnResidence, setAtLeastHalfCostForOwnResidence] = useState(true);
  const [usedSameCreditInPastThreeYears, setUsedSameCreditInPastThreeYears] = useState(false);

  const result = useMemo(() => {
    try {
      return estimateBarrierFreeRenovationDeduction({
        residenceYear: Number(residenceYear) || 0,
        floorAreaCategory,
        totalIncomeJpy: totalIncomeJpy || 0,
        qualifyingPersonCategory,
        standardCostJpy: standardCostJpy || 0,
        otherRelatedWorkCostJpy: otherRelatedWorkCostJpy || 0,
        workCompletedWithinSixMonths,
        atLeastHalfCostForOwnResidence,
        usedSameCreditInPastThreeYears,
      });
    } catch {
      return null;
    }
  }, [
    residenceYear,
    floorAreaCategory,
    totalIncomeJpy,
    qualifyingPersonCategory,
    standardCostJpy,
    otherRelatedWorkCostJpy,
    workCompletedWithinSixMonths,
    atLeastHalfCostForOwnResidence,
    usedSameCreditInPastThreeYears,
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
          <span className="text-neutral-500">床面積区分</span>
          <select
            value={floorAreaCategory}
            onChange={(e) =>
              setFloorAreaCategory(e.target.value as BarrierFreeRenovationFloorAreaCategory)
            }
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(
              Object.keys(FLOOR_AREA_CATEGORY_LABEL) as BarrierFreeRenovationFloorAreaCategory[]
            ).map((c) => (
              <option key={c} value={c}>
                {FLOOR_AREA_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <Field label="合計所得金額(円)" value={totalIncomeJpy} onChange={setTotalIncomeJpy} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            バリアフリー改修工事を行う人の該当区分(いずれか1つに該当すればよい)
          </span>
          <select
            value={qualifyingPersonCategory}
            onChange={(e) =>
              setQualifyingPersonCategory(
                e.target.value as BarrierFreeRenovationQualifyingPersonCategory,
              )
            }
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(
              Object.keys(QUALIFYING_PERSON_LABEL) as BarrierFreeRenovationQualifyingPersonCategory[]
            ).map((c) => (
              <option key={c} value={c}>
                {QUALIFYING_PERSON_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="バリアフリー改修工事に係る標準的な費用の額(円)"
          helper="増改築等工事証明書に記載された、補助金等控除後の金額をそのまま入力"
          value={standardCostJpy}
          onChange={setStandardCostJpy}
        />
        <Field
          label="併せて行う増築・改築その他の一定の工事の費用(円)"
          helper="補助金等控除後の金額。無ければ0"
          value={otherRelatedWorkCostJpy}
          onChange={setOtherRelatedWorkCostJpy}
        />
      </fieldset>

      <fieldset className="flex flex-wrap gap-4 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">要件の確認</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={workCompletedWithinSixMonths}
            onChange={(e) => setWorkCompletedWithinSixMonths(e.target.checked)}
          />
          工事完了の日から6か月以内に居住している
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={atLeastHalfCostForOwnResidence}
            onChange={(e) => setAtLeastHalfCostForOwnResidence(e.target.checked)}
          />
          工事費用の2分の1以上が自己の居住用部分の工事費用である
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={usedSameCreditInPastThreeYears}
            onChange={(e) => setUsedSameCreditInPastThreeYears(e.target.checked)}
          />
          前年以前3年内に同一住宅でこの控除の適用を受けたことがある
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
              バリアフリー改修工事の住宅特定改修特別税額控除額(所得税分のみ)
            </p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.creditJpy)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              A {yen(result.amountAJpy)} × 10% + B {yen(result.amountBJpy)} × 5%
            </p>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveBarrierFreeRenovationDeductionRecord}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="creditJpy" value={result.creditJpy.toString()} />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}
                年分のバリアフリー改修工事に係る住宅特定改修特別税額控除として登録する
              </button>
            </form>
            {registeredCreditJpy !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  登録済み({year}年分): {yen(registeredCreditJpy)}(/tax-estimateの初期値・
                  下書きCSVに反映)
                </p>
                <form action={deleteBarrierFreeRenovationDeductionRecord}>
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
