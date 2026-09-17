"use client";

import { useId, useMemo, useRef, useState } from "react";
import { saveIncomeDeduction } from "@/app/actions";
import {
  estimateSpouseDeduction,
  summarizeDependentsDeduction,
  type DependentInput,
} from "@/lib/dependentDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface DependentRow {
  key: string;
  age: string;
  totalIncome: string;
  cohabitingElderlyRelative: boolean;
}

function newDependentRow(key: string): DependentRow {
  return { key, age: "18", totalIncome: "0", cohabitingElderlyRelative: false };
}

export function DependentDeductionForm({
  year,
  defaultTaxpayerTotalIncomeJpy,
  registeredSpouseDeductionJpy,
  registeredDependentDeductionJpy,
}: {
  year: number;
  defaultTaxpayerTotalIncomeJpy: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの配偶者控除額(未登録ならnull) */
  registeredSpouseDeductionJpy: number | null;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの扶養控除額(未登録ならnull) */
  registeredDependentDeductionJpy: number | null;
}) {
  const idPrefix = useId();

  const [taxpayerTotalIncome, setTaxpayerTotalIncome] = useState(
    String(Math.round(defaultTaxpayerTotalIncomeJpy)),
  );
  const [hasEligibleSpouse, setHasEligibleSpouse] = useState(false);
  const [spouseTotalIncome, setSpouseTotalIncome] = useState("0");
  const [spouseIsElderly, setSpouseIsElderly] = useState(false);

  const spouseResult = useMemo(() => {
    try {
      return estimateSpouseDeduction({
        hasEligibleSpouse,
        taxpayerTotalIncomeJpy: taxpayerTotalIncome || 0,
        spouseTotalIncomeJpy: spouseTotalIncome || 0,
        spouseIsElderly,
        year,
      });
    } catch {
      return null;
    }
  }, [hasEligibleSpouse, taxpayerTotalIncome, spouseTotalIncome, spouseIsElderly, year]);

  const [dependents, setDependents] = useState<DependentRow[]>([]);
  const nextRowIdRef = useRef(0);

  const dependentsResult = useMemo(() => {
    try {
      const inputs: DependentInput[] = dependents.map((row) => ({
        ageAtYearEnd: Number(row.age || 0),
        totalIncomeJpy: row.totalIncome || 0,
        cohabitingElderlyRelative: row.cohabitingElderlyRelative,
        year,
      }));
      return summarizeDependentsDeduction(inputs);
    } catch {
      return null;
    }
  }, [dependents, year]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">配偶者控除・配偶者特別控除</h2>
        <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">納税者本人の合計所得金額</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={taxpayerTotalIncome}
              onChange={(e) => setTaxpayerTotalIncome(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={hasEligibleSpouse}
              onChange={(e) => setHasEligibleSpouse(e.target.checked)}
            />
            <span>控除対象配偶者がいる(民法上の配偶者・生計を一にする・青色事業専従者等でない)</span>
          </label>
          {hasEligibleSpouse && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-500">配偶者の合計所得金額</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={spouseTotalIncome}
                  onChange={(e) => setSpouseTotalIncome(e.target.value)}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={spouseIsElderly}
                  onChange={(e) => setSpouseIsElderly(e.target.checked)}
                />
                <span>配偶者がその年12月31日時点で70歳以上(老人控除対象配偶者)</span>
              </label>
            </>
          )}
        </fieldset>

        {spouseResult === null ? (
          <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
        ) : (
          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">
              配偶者控除・配偶者特別控除額(所得税 / 住民税)
            </p>
            <p className="mt-1 text-3xl font-semibold">
              {yen(spouseResult.incomeTaxAmountJpy)} / {yen(spouseResult.residentTaxAmountJpy)}
            </p>
            <form action={saveIncomeDeduction} className="mt-3">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="SPOUSE" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={spouseResult.incomeTaxAmountJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={spouseResult.residentTaxAmountJpy.toString()}
              />
              <input type="hidden" name="redirectPath" value="/dependent-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
              </button>
            </form>
            {registeredSpouseDeductionJpy !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み: {yen(registeredSpouseDeductionJpy)}(/tax-estimateの初期値に反映)
              </p>
            )}
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-500">
              {spouseResult.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">扶養控除</h2>
        <div className="flex flex-col gap-3">
          {dependents.length === 0 && (
            <p className="text-sm text-neutral-500">
              扶養親族がいない場合はそのまま(0円)。「扶養親族を追加」で入力欄を追加できる。
            </p>
          )}
          {dependents.map((row, index) => (
            <fieldset
              key={row.key}
              className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-4 dark:border-neutral-800"
            >
              <legend className="px-1 text-sm font-medium">扶養親族 {index + 1}</legend>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-500">年齢(その年12/31時点)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.age}
                  onChange={(e) =>
                    setDependents((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, age: e.target.value } : r)),
                    )
                  }
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-500">合計所得金額</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.totalIncome}
                  onChange={(e) =>
                    setDependents((prev) =>
                      prev.map((r) =>
                        r.key === row.key ? { ...r, totalIncome: e.target.value } : r,
                      ),
                    )
                  }
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              {Number(row.age || 0) >= 70 && (
                <label className="flex items-center gap-2 self-end text-sm">
                  <input
                    type="checkbox"
                    checked={row.cohabitingElderlyRelative}
                    onChange={(e) =>
                      setDependents((prev) =>
                        prev.map((r) =>
                          r.key === row.key
                            ? { ...r, cohabitingElderlyRelative: e.target.checked }
                            : r,
                        ),
                      )
                    }
                  />
                  <span>同居老親等</span>
                </label>
              )}
              <button
                type="button"
                onClick={() =>
                  setDependents((prev) => prev.filter((r) => r.key !== row.key))
                }
                className="self-end rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-red-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                削除
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            onClick={() => {
              const key = `${idPrefix}-${nextRowIdRef.current}`;
              nextRowIdRef.current += 1;
              setDependents((prev) => [...prev, newDependentRow(key)]);
            }}
            className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            扶養親族を追加
          </button>
        </div>

        {dependentsResult === null ? (
          <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
        ) : (
          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">扶養控除額(所得税 / 住民税)</p>
            <p className="mt-1 text-3xl font-semibold">
              {yen(dependentsResult.incomeTaxAmountJpy)} /{" "}
              {yen(dependentsResult.residentTaxAmountJpy)}
            </p>
            {dependentsResult.results.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-neutral-500">
                {dependentsResult.results.map((r, i) => (
                  <li key={i}>
                    扶養親族{i + 1}: {r.categoryLabel} —{" "}
                    {r.eligible
                      ? `${yen(r.incomeTaxAmountJpy)} / ${yen(r.residentTaxAmountJpy)}`
                      : "対象外"}
                    {r.residentTaxAmountUnverified && "(住民税は逓減額未確認のため0円扱い)"}
                  </li>
                ))}
              </ul>
            )}
            {dependentsResult.notes.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-600 dark:text-amber-400">
                {dependentsResult.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}
            <form action={saveIncomeDeduction} className="mt-3">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="DEPENDENT" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={dependentsResult.incomeTaxAmountJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={dependentsResult.residentTaxAmountJpy.toString()}
              />
              <input type="hidden" name="redirectPath" value="/dependent-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
              </button>
            </form>
            {registeredDependentDeductionJpy !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み: {yen(registeredDependentDeductionJpy)}(/tax-estimateの初期値に反映)
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
