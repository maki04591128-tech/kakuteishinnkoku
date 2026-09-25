"use client";

import { useMemo, useState } from "react";
import { deleteEmploymentIncomeRecord, saveEmploymentIncomeRecord } from "@/app/actions";
import { estimateEmploymentIncome } from "@/lib/employmentIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function EmploymentIncomeForm({
  year,
  registeredRecord,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既に登録済みの給与収入(未登録ならnull) */
  registeredRecord: {
    taxYear: number;
    grossSalaryJpy: number;
    employmentIncomeJpy: number;
  } | null;
}) {
  const [grossSalary, setGrossSalary] = useState(
    registeredRecord !== null ? String(registeredRecord.grossSalaryJpy) : "0",
  );

  const result = useMemo(() => {
    try {
      return estimateEmploymentIncome({ year, grossSalaryJpy: grossSalary || 0 });
    } catch {
      return null;
    }
  }, [year, grossSalary]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">給与収入金額(源泉徴収票の「支払金額」)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={grossSalary}
            onChange={(e) => setGrossSalary(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">給与所得控除額</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.employmentIncomeDeductionJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">給与所得金額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.employmentIncomeJpy)}</p>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveEmploymentIncomeRecord}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="grossSalaryJpy" value={result.grossSalaryJpy.toString()} />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この給与収入金額を{year}年分として登録する
              </button>
            </form>
            {registeredRecord !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  登録済み({registeredRecord.taxYear}年分): 給与収入{" "}
                  {yen(registeredRecord.grossSalaryJpy)} / 給与所得{" "}
                  {yen(registeredRecord.employmentIncomeJpy)}(/tax-estimateの初期値に反映)
                </p>
                <form action={deleteEmploymentIncomeRecord}>
                  <input type="hidden" name="year" value={registeredRecord.taxYear} />
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
