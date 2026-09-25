"use client";

import { useMemo, useState } from "react";
import {
  carryForwardHomeReplacementLossExcess,
  deleteIncomeDeduction,
  saveIncomeDeduction,
} from "@/app/actions";
import {
  calculateHomeReplacementLoss,
  calculateHomeReplacementLossCarryforward,
} from "@/lib/realEstate/homeReplacementLossCarryforward";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function HomeReplacementLossDeductionForm({
  year,
  registeredDeduction,
  carryforwardEntries,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
  /** 年初時点で残っている繰越譲渡損失の残高(発生年ごと。データ取り込み画面で登録) */
  carryforwardEntries: { originYear: number; remainingAmountJpy: string }[];
}) {
  const [transferPrice, setTransferPrice] = useState("0");
  const [acquisitionCost, setAcquisitionCost] = useState("0");
  const [transferExpenses, setTransferExpenses] = useState("0");
  const [ownershipYears, setOwnershipYears] = useState("6");
  const [oldSiteArea, setOldSiteArea] = useState("200");
  const [newHomeFloorArea, setNewHomeFloorArea] = useState("80");
  const [newHomeMortgageExists, setNewHomeMortgageExists] = useState(false);
  const [movedInByDeadline, setMovedInByDeadline] = useState(false);
  const [otherRequirementsEligible, setOtherRequirementsEligible] = useState(false);
  const [totalIncome, setTotalIncome] = useState("0");
  const [carryforwardMortgageMaintained, setCarryforwardMortgageMaintained] = useState(true);

  const result = useMemo(() => {
    try {
      return calculateHomeReplacementLoss({
        transferPriceJpy: transferPrice === "" ? 0 : transferPrice,
        acquisitionCostJpy: acquisitionCost === "" ? 0 : acquisitionCost,
        transferExpensesJpy: transferExpenses === "" ? 0 : transferExpenses,
        ownershipYears: ownershipYears === "" ? 0 : Number(ownershipYears),
        oldSiteAreaSqm: oldSiteArea === "" ? 0 : oldSiteArea,
        newHomeFloorAreaSqm: newHomeFloorArea === "" ? 0 : newHomeFloorArea,
        newHomeMortgageExists,
        movedInByDeadline,
        otherRequirementsEligible,
      });
    } catch {
      return null;
    }
  }, [
    transferPrice,
    acquisitionCost,
    transferExpenses,
    ownershipYears,
    oldSiteArea,
    newHomeFloorArea,
    newHomeMortgageExists,
    movedInByDeadline,
    otherRequirementsEligible,
  ]);

  const totalCarriedForwardJpy = carryforwardEntries.reduce(
    (sum, e) => sum + Number(e.remainingAmountJpy),
    0,
  );

  const carryforwardResult = useMemo(() => {
    if (result === null) return null;
    try {
      return calculateHomeReplacementLossCarryforward(
        year,
        result.eligibleLossJpy,
        totalIncome === "" ? 0 : totalIncome,
        carryforwardMortgageMaintained,
        carryforwardEntries,
      );
    } catch {
      return null;
    }
  }, [result, year, totalIncome, carryforwardMortgageMaintained, carryforwardEntries]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <Field label="譲渡価額(旧居宅の売却代金)" value={transferPrice} onChange={setTransferPrice} />
        <Field label="取得費(旧居宅)" value={acquisitionCost} onChange={setAcquisitionCost} />
        <Field
          label="譲渡費用(仲介手数料・印紙税等)"
          value={transferExpenses}
          onChange={setTransferExpenses}
        />
        <Field
          label="譲渡した年の1月1日時点の旧居宅の所有期間(年)"
          value={ownershipYears}
          onChange={setOwnershipYears}
        />
        <Field label="旧居宅の敷地面積(㎡)" value={oldSiteArea} onChange={setOldSiteArea} />
        <Field
          label="買換資産(新居宅)の床面積(㎡)"
          value={newHomeFloorArea}
          onChange={setNewHomeFloorArea}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={newHomeMortgageExists}
            onChange={(e) => setNewHomeMortgageExists(e.target.checked)}
          />
          <span className="text-neutral-500">
            買換資産を取得した年の12月31日時点で、その家屋に係る償還期間10年以上の
            住宅借入金等がある
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={movedInByDeadline}
            onChange={(e) => setMovedInByDeadline(e.target.checked)}
          />
          <span className="text-neutral-500">
            買換資産に取得した年の翌年12月31日までの間に居住した(または居住する見込みである)
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={otherRequirementsEligible}
            onChange={(e) => setOtherRequirementsEligible(e.target.checked)}
          />
          <span className="text-neutral-500">
            上記以外の要件(自己の居住用財産であること、配偶者・直系血族等特別の関係が
            ある者への譲渡でないこと、前年・前々年に他の居住用財産譲渡の特例の適用を
            受けていないこと等)を満たすことを確認した
          </span>
        </label>
        <Field label="その年の総所得金額等" value={totalIncome} onChange={setTotalIncome} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={carryforwardMortgageMaintained}
            onChange={(e) => setCarryforwardMortgageMaintained(e.target.checked)}
          />
          <span className="text-neutral-500">
            (繰越控除を使う場合)この年の12月31日時点でも買換資産に係る償還期間10年以上の
            住宅借入金等がある
          </span>
        </label>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(金額・面積は0以上、所有期間は0以上の整数)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">譲渡損失額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.transferLossJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">損益通算・繰越控除の対象額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.eligibleLossJpy)}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <DetailItem
              label="所有期間の要件(5年超)"
              value={result.ownershipPeriodEligible ? "満たす" : "満たさない"}
            />
            <DetailItem
              label="買換資産の床面積の要件(50㎡以上)"
              value={result.floorAreaEligible ? "満たす" : "満たさない"}
            />
            <DetailItem
              label="敷地面積按分割合(500㎡超部分を除外)"
              value={`${result.siteAreaProrationRatio.times(100).toFixed(1)}%`}
            />
            <DetailItem label="この特例の対象になるか" value={result.eligible ? "対象になる" : "対象外"} />
          </dl>

          {result.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
              {result.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}

          {carryforwardEntries.length > 0 && (
            <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-900">
              {year}年初時点の繰越譲渡損失残高(合計): {yen(totalCarriedForwardJpy)}(
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
                繰越控除の使用額 {yen(carryforwardResult.totalCarryforwardUsedJpy)} + 当年発生分の
                適用額 {yen(carryforwardResult.currentYearLossUsedJpy)}
              </p>
              {carryforwardResult.carryforwardIncomeLimitExceeded && (
                <p className="mt-1 text-xs text-red-600">
                  その年の総所得金額等(合計所得金額)が3,000万円を超えているため、前年以前
                  からの繰越控除は使用できない(当年発生分の損益通算はそのまま適用される)。
                </p>
              )}
              {carryforwardResult.carryforwardMortgageRequirementUnmet && (
                <p className="mt-1 text-xs text-red-600">
                  その年の12月31日時点で買換資産に係る償還期間10年以上の住宅借入金等が
                  無いため、前年以前からの繰越控除は使用できない(当年発生分の損益通算は
                  そのまま適用される)。
                </p>
              )}
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
                  控除期限切れで使用できなかった繰越譲渡損失があります:{" "}
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
              <input type="hidden" name="type" value="HOME_REPLACEMENT_LOSS" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={(
                  carryforwardResult?.totalDeductionAppliedJpy ?? result.eligibleLossJpy
                ).toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={(
                  carryforwardResult?.totalDeductionAppliedJpy ?? result.eligibleLossJpy
                ).toString()}
              />
              <input type="hidden" name="redirectPath" value="/home-replacement-loss-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この年分の所得控除として登録する
              </button>
            </form>
            {registeredDeduction !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  登録済み: 所得税 {yen(registeredDeduction.incomeTaxAmountJpy)} / 住民税{" "}
                  {yen(registeredDeduction.residentTaxAmountJpy)}(/tax-estimateの初期値に反映)
                </p>
                <form action={deleteIncomeDeduction}>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="type" value="HOME_REPLACEMENT_LOSS" />
                  <input type="hidden" name="redirectPath" value="/home-replacement-loss-deduction" />
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

          {carryforwardResult !== null && carryforwardResult.newLossJpy.greaterThan(0) && (
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">
                {year}年分で控除しきれず翌年以後に繰り越す譲渡損失額
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(carryforwardResult.newLossJpy)}
              </p>
              <form action={carryForwardHomeReplacementLossExcess} className="mt-3">
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
