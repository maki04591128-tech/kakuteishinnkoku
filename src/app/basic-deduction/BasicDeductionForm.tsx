"use client";

import { useMemo, useState } from "react";
import { deleteIncomeDeduction, saveIncomeDeduction } from "@/app/actions";
import { estimateBasicDeduction } from "@/lib/basicDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function BasicDeductionForm({
  year,
  registeredDeductionJpy,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeductionJpy: number | null;
}) {
  const [totalIncome, setTotalIncome] = useState("5000000");

  const result = useMemo(() => {
    try {
      return estimateBasicDeduction({ totalIncomeJpy: totalIncome || 0, year });
    } catch {
      return null;
    }
  }, [totalIncome, year]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">合計所得金額</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">その年の合計所得金額</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={totalIncome}
            onChange={(e) => setTotalIncome(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">基礎控除額(所得税 / 住民税)</p>
            <p className="mt-1 text-3xl font-semibold">
              {yen(result.incomeTaxAmountJpy)} / {yen(result.residentTaxAmountJpy)}
            </p>
            <form action={saveIncomeDeduction} className="mt-3">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="BASIC" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={result.incomeTaxAmountJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={result.residentTaxAmountJpy.toString()}
              />
              <input type="hidden" name="redirectPath" value="/basic-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
              </button>
            </form>
            {registeredDeductionJpy !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  登録済み: {yen(registeredDeductionJpy)}(/tax-estimateの初期値に反映)
                </p>
                <form action={deleteIncomeDeduction}>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="type" value="BASIC" />
                  <input type="hidden" name="redirectPath" value="/basic-deduction" />
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
