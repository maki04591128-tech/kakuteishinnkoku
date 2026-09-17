"use client";

import { useMemo, useState } from "react";
import { carryForwardCasualtyLossExcess, saveIncomeDeduction } from "@/app/actions";
import { calculateCasualtyLossCarryforward } from "@/lib/casualtyLossCarryforward";
import { estimateCasualtyLossDeduction } from "@/lib/casualtyLossDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function CasualtyLossDeductionForm({
  year,
  registeredDeduction,
  carryforwardEntries,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
  /** 年初時点で残っている繰越雑損失の残高(発生年ごと。データ取り込み画面で登録) */
  carryforwardEntries: { originYear: number; remainingAmountJpy: string }[];
}) {
  const [damageAmount, setDamageAmount] = useState("0");
  const [disasterRelatedExpense, setDisasterRelatedExpense] = useState("0");
  const [insuranceReimbursement, setInsuranceReimbursement] = useState("0");
  const [totalIncome, setTotalIncome] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateCasualtyLossDeduction({
        damageAmountJpy: damageAmount === "" ? 0 : damageAmount,
        disasterRelatedExpenseJpy: disasterRelatedExpense === "" ? 0 : disasterRelatedExpense,
        insuranceReimbursementJpy: insuranceReimbursement === "" ? 0 : insuranceReimbursement,
        totalIncomeJpy: totalIncome === "" ? 0 : totalIncome,
      });
    } catch {
      return null;
    }
  }, [damageAmount, disasterRelatedExpense, insuranceReimbursement, totalIncome]);

  const totalCarriedForwardJpy = carryforwardEntries.reduce(
    (sum, e) => sum + Number(e.remainingAmountJpy),
    0,
  );

  const carryforwardResult = useMemo(() => {
    if (result === null) return null;
    try {
      return calculateCasualtyLossCarryforward(
        year,
        result.incomeTaxDeductionJpy,
        totalIncome === "" ? 0 : totalIncome,
        carryforwardEntries,
      );
    } catch {
      return null;
    }
  }, [result, year, totalIncome, carryforwardEntries]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <Field
          label="損害金額(損失発生直前の資産の時価等を基礎に算出。保険金等控除前)"
          value={damageAmount}
          onChange={setDamageAmount}
        />
        <Field
          label="災害等関連支出の金額(取り壊し費用・原状回復費用・盗難防止費用等。保険金等控除前)"
          value={disasterRelatedExpense}
          onChange={setDisasterRelatedExpense}
        />
        <Field
          label="保険金・損害賠償金等により補填される金額"
          value={insuranceReimbursement}
          onChange={setInsuranceReimbursement}
        />
        <Field label="その年の総所得金額等" value={totalIncome} onChange={setTotalIncome} />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">雑損控除額(所得税)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.incomeTaxDeductionJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">雑損控除額(住民税)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.residentTaxDeductionJpy)}</p>
            </div>
          </div>

          {carryforwardEntries.length > 0 && (
            <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-900">
              {year}年初時点の繰越雑損失残高(合計): {yen(totalCarriedForwardJpy)}(
              {carryforwardEntries
                .map((e) => `${e.originYear}年分 ${yen(Number(e.remainingAmountJpy))}`)
                .join(" / ")}
              )
            </p>
          )}

          {carryforwardResult !== null && (
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">
                実際にその年の総所得金額等から控除できる合計額
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(carryforwardResult.totalDeductionAppliedJpy)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                繰越控除の使用額 {yen(carryforwardResult.totalCarryforwardUsedJpy)} + 当年分の
                適用額 {yen(carryforwardResult.currentYearDeductionUsedJpy)}
              </p>
              {carryforwardResult.usedCarryforwardByOriginYear.length > 0 && (
                <p className="mt-1 text-xs text-neutral-400">
                  繰越控除の内訳:{" "}
                  {carryforwardResult.usedCarryforwardByOriginYear
                    .map((u) => `${u.originYear}年分 ${yen(u.usedAmountJpy)}`)
                    .join(" / ")}
                </p>
              )}
              {carryforwardResult.expiredByOriginYear.length > 0 && (
                <p className="mt-2 text-xs text-red-600">
                  控除期限切れで使用できなかった繰越雑損失があります:{" "}
                  {carryforwardResult.expiredByOriginYear
                    .map((e) => `${e.originYear}年分 ${yen(e.expiredAmountJpy)}`)
                    .join(" / ")}
                </p>
              )}
            </div>
          )}

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveIncomeDeduction}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="CASUALTY_LOSS" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={(
                  carryforwardResult?.totalDeductionAppliedJpy ?? result.incomeTaxDeductionJpy
                ).toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={(
                  carryforwardResult?.totalDeductionAppliedJpy ?? result.residentTaxDeductionJpy
                ).toString()}
              />
              <input type="hidden" name="redirectPath" value="/casualty-loss-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この年分の所得控除として登録する
              </button>
            </form>
            {registeredDeduction !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み: 所得税 {yen(registeredDeduction.incomeTaxAmountJpy)} / 住民税{" "}
                {yen(registeredDeduction.residentTaxAmountJpy)}(/tax-estimateの初期値に反映)
              </p>
            )}
          </div>

          {carryforwardResult !== null && carryforwardResult.newLossJpy.greaterThan(0) && (
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">
                {year}年分で控除しきれず翌年以後に繰り越す雑損失額
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(carryforwardResult.newLossJpy)}
              </p>
              <form action={carryForwardCasualtyLossExcess} className="mt-3">
                <input type="hidden" name="year" value={year} />
                <input
                  type="hidden"
                  name="carryforwardToNextYearJson"
                  value={JSON.stringify(
                    carryforwardResult.carryforwardToNextYear
                      .filter((c) => c.originYear === year)
                      .map((c) => ({
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
            </div>
          )}

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <DetailItem label="差引損失額" value={yen(result.netLossJpy)} />
            <DetailItem
              label="差引損失額のうち災害関連支出額"
              value={yen(result.netDisasterRelatedExpenseJpy)}
            />
            <DetailItem
              label="算式1: 差引損失額-総所得金額等×10%"
              value={yen(result.incomeBasedAmountJpy)}
            />
            <DetailItem
              label="算式2: 災害関連支出額-5万円"
              value={yen(result.expenseBasedAmountJpy)}
            />
          </dl>

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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
