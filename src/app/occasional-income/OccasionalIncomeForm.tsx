"use client";

import { useMemo, useState } from "react";
import { estimateOccasionalIncome } from "@/lib/occasionalIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function OccasionalIncomeForm() {
  const [totalRevenueJpy, setTotalRevenueJpy] = useState("0");
  const [expensesJpy, setExpensesJpy] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateOccasionalIncome({
        totalRevenueJpy: totalRevenueJpy === "" ? 0 : totalRevenueJpy,
        expensesJpy: expensesJpy === "" ? 0 : expensesJpy,
      });
    } catch {
      return null;
    }
  }, [totalRevenueJpy, expensesJpy]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            総収入金額(生命保険の満期返戻金・懸賞金等の年間合計)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={totalRevenueJpy}
            onChange={(e) => setTotalRevenueJpy(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            その収入を得るために直接要した支出額(生命保険料の払込総額等)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={expensesJpy}
            onChange={(e) => setExpensesJpy(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(0以上の数値、かつ支出額は総収入金額以下)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">特別控除額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.specialDeductionJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">一時所得の金額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.occasionalIncomeJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">総所得金額に算入する額(2分の1)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.taxableAmountJpy)}</p>
            </div>
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
