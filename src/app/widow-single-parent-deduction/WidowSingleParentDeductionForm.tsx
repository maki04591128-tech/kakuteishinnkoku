"use client";

import { useMemo, useState } from "react";
import { saveIncomeDeduction } from "@/app/actions";
import {
  estimateWidowSingleParentDeduction,
  type WidowSingleParentCategory,
} from "@/lib/widowSingleParentDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function WidowSingleParentDeductionForm({
  year,
  registeredCategoryDeduction,
  registeredWorkingStudentDeduction,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの寡婦・ひとり親控除額(未登録ならnull) */
  registeredCategoryDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
  /** 同様に既に登録済みの勤労学生控除額(未登録ならnull) */
  registeredWorkingStudentDeduction:
    | { incomeTaxAmountJpy: number; residentTaxAmountJpy: number }
    | null;
}) {
  const [category, setCategory] = useState<WidowSingleParentCategory>("NONE");
  const [workingStudent, setWorkingStudent] = useState(false);

  const result = useMemo(
    () => estimateWidowSingleParentDeduction({ category, workingStudent }),
    [category, workingStudent],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">寡婦控除・ひとり親控除の区分(選択制)</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WidowSingleParentCategory)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="NONE">該当なし</option>
            <option value="WIDOW">寡婦控除</option>
            <option value="SINGLE_PARENT">ひとり親控除</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={workingStudent}
            onChange={(e) => setWorkingStudent(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span>勤労学生控除に該当する</span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
          <p className="text-sm text-neutral-500">控除額合計(所得税)</p>
          <p className="mt-1 text-3xl font-semibold">{yen(result.totalIncomeTaxDeductionJpy)}</p>
        </div>
        <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
          <p className="text-sm text-neutral-500">控除額合計(住民税)</p>
          <p className="mt-1 text-3xl font-semibold">
            {yen(result.totalResidentTaxDeductionJpy)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium">寡婦控除・ひとり親控除</p>
          <p className="mt-1 text-sm text-neutral-500">
            所得税 {yen(result.categoryIncomeTaxDeductionJpy)} / 住民税{" "}
            {yen(result.categoryResidentTaxDeductionJpy)}
          </p>
          <form action={saveIncomeDeduction} className="mt-3">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="type" value="WIDOW_SINGLE_PARENT" />
            <input
              type="hidden"
              name="incomeTaxAmountJpy"
              value={result.categoryIncomeTaxDeductionJpy.toString()}
            />
            <input
              type="hidden"
              name="residentTaxAmountJpy"
              value={result.categoryResidentTaxDeductionJpy.toString()}
            />
            <input type="hidden" name="redirectPath" value="/widow-single-parent-deduction" />
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              この試算結果を{year}年分の所得控除として登録する
            </button>
          </form>
          {registeredCategoryDeduction !== null && (
            <p className="mt-2 text-xs text-neutral-500">
              登録済み: 所得税 {yen(registeredCategoryDeduction.incomeTaxAmountJpy)} / 住民税{" "}
              {yen(registeredCategoryDeduction.residentTaxAmountJpy)}
              (/tax-estimateの初期値に反映)
            </p>
          )}
        </div>

        <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium">勤労学生控除</p>
          <p className="mt-1 text-sm text-neutral-500">
            所得税 {yen(result.workingStudentIncomeTaxDeductionJpy)} / 住民税{" "}
            {yen(result.workingStudentResidentTaxDeductionJpy)}
          </p>
          <form action={saveIncomeDeduction} className="mt-3">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="type" value="WORKING_STUDENT" />
            <input
              type="hidden"
              name="incomeTaxAmountJpy"
              value={result.workingStudentIncomeTaxDeductionJpy.toString()}
            />
            <input
              type="hidden"
              name="residentTaxAmountJpy"
              value={result.workingStudentResidentTaxDeductionJpy.toString()}
            />
            <input type="hidden" name="redirectPath" value="/widow-single-parent-deduction" />
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              この試算結果を{year}年分の所得控除として登録する
            </button>
          </form>
          {registeredWorkingStudentDeduction !== null && (
            <p className="mt-2 text-xs text-neutral-500">
              登録済み: 所得税 {yen(registeredWorkingStudentDeduction.incomeTaxAmountJpy)} / 住民税{" "}
              {yen(registeredWorkingStudentDeduction.residentTaxAmountJpy)}
              (/tax-estimateの初期値に反映)
            </p>
          )}
        </div>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
        {result.notes.map((note, i) => (
          <li key={i}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
