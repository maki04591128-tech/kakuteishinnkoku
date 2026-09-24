"use client";

import { useMemo, useState } from "react";
import {
  MUNICIPALITY_GRADE_CLASS_LABEL,
  estimateResidentTaxNonTaxable,
  type MunicipalityGradeClass,
} from "@/lib/residentTaxNonTaxable";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function ResidentTaxNonTaxableForm() {
  const [totalIncomeJpy, setTotalIncomeJpy] = useState("0");
  const [dependentCount, setDependentCount] = useState("0");
  const [disability, setDisability] = useState(false);
  const [minor, setMinor] = useState(false);
  const [widowOrSingleParent, setWidowOrSingleParent] = useState(false);
  const [gradeClass, setGradeClass] = useState<MunicipalityGradeClass>("GRADE_1");

  const result = useMemo(() => {
    try {
      return estimateResidentTaxNonTaxable({
        totalIncomeJpy: totalIncomeJpy === "" ? 0 : totalIncomeJpy,
        dependentCount: dependentCount === "" ? 0 : Number(dependentCount),
        disability,
        minor,
        widowOrSingleParent,
        gradeClass,
      });
    } catch {
      return null;
    }
  }, [totalIncomeJpy, dependentCount, disability, minor, widowOrSingleParent, gradeClass]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">合計所得金額</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={totalIncomeJpy}
            onChange={(e) => setTotalIncomeJpy(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            同一生計配偶者・扶養親族の人数(16歳未満の年少扶養親族を含む)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={dependentCount}
            onChange={(e) => setDependentCount(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
        <span className="text-neutral-500">居住する市区町村の級地区分</span>
        <select
          value={gradeClass}
          onChange={(e) => setGradeClass(e.target.value as MunicipalityGradeClass)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {(Object.entries(MUNICIPALITY_GRADE_CLASS_LABEL) as [MunicipalityGradeClass, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-neutral-500">
          該当する区分(前年の合計所得金額135万円以下なら非課税になる特例の対象)
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={disability}
            onChange={(e) => setDisability(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span>障害者に該当する</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={minor}
            onChange={(e) => setMinor(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span>未成年者(その年の1月1日時点で18歳未満)に該当する</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={widowOrSingleParent}
            onChange={(e) => setWidowOrSingleParent(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span>寡婦控除・ひとり親控除に該当する</span>
        </label>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ResultCard
              title="均等割"
              nonTaxable={result.perCapitaLevyNonTaxable}
              thresholdJpy={result.perCapitaLevyThresholdJpy}
            />
            <ResultCard
              title="所得割"
              nonTaxable={result.incomeLevyNonTaxable}
              thresholdJpy={result.incomeLevyThresholdJpy}
            />
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

function ResultCard({
  title,
  nonTaxable,
  thresholdJpy,
}: {
  title: string;
  nonTaxable: boolean;
  thresholdJpy: { toString(): string };
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        nonTaxable
          ? "border-emerald-600 dark:border-emerald-400"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">
        {nonTaxable ? "非課税" : "課税"}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        所得金額基準の非課税限度額: {yen(thresholdJpy)}
      </p>
    </div>
  );
}
