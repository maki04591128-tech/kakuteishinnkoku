"use client";

import { useMemo, useState } from "react";
import { estimatePublicPensionIncome } from "@/lib/publicPensionIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function PublicPensionIncomeForm() {
  const [pensionIncomeJpy, setPensionIncomeJpy] = useState("0");
  const [isAge65OrOlder, setIsAge65OrOlder] = useState(false);
  const [otherIncomeJpy, setOtherIncomeJpy] = useState("0");

  const result = useMemo(() => {
    try {
      return estimatePublicPensionIncome({
        pensionIncomeJpy: pensionIncomeJpy === "" ? 0 : pensionIncomeJpy,
        isAge65OrOlder,
        otherIncomeExcludingPensionJpy: otherIncomeJpy === "" ? 0 : otherIncomeJpy,
      });
    } catch {
      return null;
    }
  }, [pensionIncomeJpy, isAge65OrOlder, otherIncomeJpy]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            公的年金等の収入金額(国民年金・厚生年金・企業年金等の年間合計)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={pensionIncomeJpy}
            onChange={(e) => setPensionIncomeJpy(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            公的年金等に係る雑所得以外の合計所得金額(給与所得・事業所得等)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={otherIncomeJpy}
            onChange={(e) => setOtherIncomeJpy(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isAge65OrOlder}
            onChange={(e) => setIsAge65OrOlder(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span className="text-neutral-500">
            収入のあった年の12月31日時点で65歳以上(最低保障額が110万円になる)
          </span>
        </label>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">公的年金等控除額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.deductionJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">公的年金等に係る雑所得の金額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.miscIncomeJpy)}</p>
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
