"use client";

import { Decimal } from "decimal.js";
import { useMemo, useState } from "react";
import {
  carryForwardForeignTaxCreditExcess,
  carryForwardForeignTaxCreditSpareLimit,
} from "@/app/actions";
import { calculateForeignTaxCredit } from "@/lib/investment/foreignTaxCredit";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function ForeignTaxCreditForm({
  year,
  carryforwardEntries,
  spareLimitCarryforwardEntries,
}: {
  year: number;
  carryforwardEntries: { originYear: number; remainingAmountJpy: string }[];
  spareLimitCarryforwardEntries: { originYear: number; remainingAmountJpy: string }[];
}) {
  const [incomeTaxJpy, setIncomeTaxJpy] = useState("300000");
  const [totalIncomeJpy, setTotalIncomeJpy] = useState("5000000");
  const [foreignSourceIncomeJpy, setForeignSourceIncomeJpy] = useState("300000");
  const [foreignIncomeTaxPaidJpy, setForeignIncomeTaxPaidJpy] = useState("30000");

  const totalCarriedForwardJpy = carryforwardEntries.reduce(
    (sum, e) => sum + Number(e.remainingAmountJpy),
    0,
  );
  const totalSpareLimitCarriedForwardJpy = spareLimitCarryforwardEntries.reduce(
    (sum, e) => sum + Number(e.remainingAmountJpy),
    0,
  );

  const result = useMemo(() => {
    try {
      return calculateForeignTaxCredit({
        currentYear: year,
        incomeTaxJpy: incomeTaxJpy === "" ? 0 : incomeTaxJpy,
        totalIncomeJpy: totalIncomeJpy === "" ? 0 : totalIncomeJpy,
        foreignSourceIncomeJpy: foreignSourceIncomeJpy === "" ? 0 : foreignSourceIncomeJpy,
        foreignIncomeTaxPaidJpy: foreignIncomeTaxPaidJpy === "" ? 0 : foreignIncomeTaxPaidJpy,
        carryforwardEntries,
        spareLimitCarryforwardEntries,
      });
    } catch {
      return null;
    }
  }, [
    year,
    incomeTaxJpy,
    totalIncomeJpy,
    foreignSourceIncomeJpy,
    foreignIncomeTaxPaidJpy,
    carryforwardEntries,
    spareLimitCarryforwardEntries,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="所得税額(他の税額控除適用前・復興特別所得税を除く)"
          value={incomeTaxJpy}
          onChange={setIncomeTaxJpy}
        />
        <Field
          label="所得総額(総所得金額等・全所得の合計)"
          value={totalIncomeJpy}
          onChange={setTotalIncomeJpy}
        />
        <Field
          label="国外所得金額(外国株式配当等、控除対象の国外所得の合計)"
          value={foreignSourceIncomeJpy}
          onChange={setForeignSourceIncomeJpy}
        />
        <Field
          label="外国所得税額(現地で源泉徴収された税額の年間合計・円換算)"
          value={foreignIncomeTaxPaidJpy}
          onChange={setForeignIncomeTaxPaidJpy}
        />
      </div>

      <div className="rounded-md bg-neutral-50 p-3 text-xs text-neutral-500 dark:bg-neutral-900">
        <p>
          {year}年初時点の繰越控除限度超過額(発生年ごとの登録はデータ取り込み画面):{" "}
          {yen(totalCarriedForwardJpy)}
          {carryforwardEntries.length > 0 && (
            <span>
              {" "}
              (
              {carryforwardEntries
                .map((e) => `${e.originYear}年分 ${yen(Number(e.remainingAmountJpy))}`)
                .join(" / ")}
              )
            </span>
          )}
        </p>
        <p className="mt-1">
          {year}年初時点の繰越控除余裕額(発生年ごとの登録はデータ取り込み画面):{" "}
          {yen(totalSpareLimitCarriedForwardJpy)}
          {spareLimitCarryforwardEntries.length > 0 && (
            <span>
              {" "}
              (
              {spareLimitCarryforwardEntries
                .map((e) => `${e.originYear}年分 ${yen(Number(e.remainingAmountJpy))}`)
                .join(" / ")}
              )
            </span>
          )}
        </p>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <LimitCard label="所得税の控除限度額" value={result.incomeTaxLimitJpy} />
            <LimitCard
              label="復興特別所得税の控除限度額"
              value={result.reconstructionSurtaxLimitJpy}
            />
            <LimitCard label="住民税の控除限度額(概算)" value={result.residentTaxLimitJpy} />
          </div>

          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">合計控除限度額</p>
            <p className="mt-1 text-2xl font-semibold">{yen(result.totalLimitJpy)}</p>
          </div>

          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500">外国税額控除として使える合計額</p>
            <p className="mt-1 text-2xl font-semibold">{yen(result.totalCreditJpy)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              当年発生分から{yen(result.creditFromCurrentYearJpy)}
              {result.creditFromCarryforwardJpy.greaterThan(0) &&
                ` + 繰越控除限度超過額から${yen(result.creditFromCarryforwardJpy)}`}
              {result.creditFromSpareLimitCarryforwardJpy.greaterThan(0) &&
                ` + 繰越控除余裕額から${yen(result.creditFromSpareLimitCarryforwardJpy)}`}
            </p>
            {result.usedCarryforwardByOriginYear.length > 0 && (
              <p className="mt-1 text-xs text-neutral-400">
                繰越控除限度超過額の内訳:{" "}
                {result.usedCarryforwardByOriginYear
                  .map((u) => `${u.originYear}年分 ${yen(u.usedAmountJpy)}`)
                  .join(" / ")}
              </p>
            )}
            {result.usedSpareLimitCarryforwardByOriginYear.length > 0 && (
              <p className="mt-1 text-xs text-neutral-400">
                繰越控除余裕額の内訳:{" "}
                {result.usedSpareLimitCarryforwardByOriginYear
                  .map((u) => `${u.originYear}年分 ${yen(u.usedAmountJpy)}`)
                  .join(" / ")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">翌年以後に繰り越す控除限度超過額</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(
                  result.carryforwardToNextYear.reduce(
                    (sum, c) => sum.plus(c.remainingAmountJpy),
                    new Decimal(0),
                  ),
                )}
              </p>
              {result.carryforwardToNextYear.length > 0 && (
                <p className="mt-1 text-xs text-neutral-400">
                  {result.carryforwardToNextYear
                    .map((c) => `${c.originYear}年分 ${yen(c.remainingAmountJpy)}`)
                    .join(" / ")}
                </p>
              )}
              {result.expiredCarryforwardByOriginYear.length > 0 && (
                <p className="mt-2 text-xs text-red-600">
                  控除期限切れで使用できなかった繰越控除限度超過額:{" "}
                  {result.expiredCarryforwardByOriginYear
                    .map((e) => `${e.originYear}年分 ${yen(e.expiredAmountJpy)}`)
                    .join(" / ")}
                </p>
              )}
              {result.carryforwardToNextYear.length > 0 && (
                <form action={carryForwardForeignTaxCreditExcess} className="mt-3">
                  <input type="hidden" name="year" value={year} />
                  <input
                    type="hidden"
                    name="carryforwardToNextYearJson"
                    value={JSON.stringify(
                      result.carryforwardToNextYear.map((c) => ({
                        originYear: c.originYear,
                        remainingAmountJpy: c.remainingAmountJpy.toString(),
                      })),
                    )}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    {year + 1}年分として登録する
                  </button>
                </form>
              )}
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">翌年以後に繰り越す控除余裕額</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(
                  result.spareLimitCarryforwardToNextYear.reduce(
                    (sum, c) => sum.plus(c.remainingAmountJpy),
                    new Decimal(0),
                  ),
                )}
              </p>
              {result.spareLimitCarryforwardToNextYear.length > 0 && (
                <p className="mt-1 text-xs text-neutral-400">
                  {result.spareLimitCarryforwardToNextYear
                    .map((c) => `${c.originYear}年分 ${yen(c.remainingAmountJpy)}`)
                    .join(" / ")}
                </p>
              )}
              {result.expiredSpareLimitCarryforwardByOriginYear.length > 0 && (
                <p className="mt-2 text-xs text-red-600">
                  控除期限切れで使用できなかった繰越控除余裕額:{" "}
                  {result.expiredSpareLimitCarryforwardByOriginYear
                    .map((e) => `${e.originYear}年分 ${yen(e.expiredAmountJpy)}`)
                    .join(" / ")}
                </p>
              )}
              {result.spareLimitCarryforwardToNextYear.length > 0 && (
                <form action={carryForwardForeignTaxCreditSpareLimit} className="mt-3">
                  <input type="hidden" name="year" value={year} />
                  <input
                    type="hidden"
                    name="spareLimitCarryforwardToNextYearJson"
                    value={JSON.stringify(
                      result.spareLimitCarryforwardToNextYear.map((c) => ({
                        originYear: c.originYear,
                        remainingAmountJpy: c.remainingAmountJpy.toString(),
                      })),
                    )}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    {year + 1}年分として登録する
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
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

function LimitCard({ label, value }: { label: string; value: { toString(): string } }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{yen(value)}</p>
    </div>
  );
}
