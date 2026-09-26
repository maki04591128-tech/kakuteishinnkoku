"use client";

import { useMemo, useState } from "react";
import {
  simulateStockOptionTax,
  type StockOptionCompanyType,
} from "@/lib/investment/stockOptionTaxSimulation";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900";

export function StockOptionTaxForm() {
  const [companyType, setCompanyType] = useState<StockOptionCompanyType>("LISTED_5Y_OR_MORE");
  const [grantContractPrice, setGrantContractPrice] = useState("1000");
  const [exercisePrice, setExercisePrice] = useState("1000");
  const [fairMarketValueAtExercise, setFairMarketValueAtExercise] = useState("3000");
  const [alreadySold, setAlreadySold] = useState(true);
  const [salePrice, setSalePrice] = useState("5000");
  const [shares, setShares] = useState("1000");
  const [grantDate, setGrantDate] = useState("2021-01-01");
  const [exerciseDate, setExerciseDate] = useState("2023-06-01");
  const [otherQualifiedExercises, setOtherQualifiedExercises] = useState("0");
  const [otherRequirementsConfirmed, setOtherRequirementsConfirmed] = useState(false);
  const [isBusinessConsultant, setIsBusinessConsultant] = useState(false);
  const [otherTaxableIncome, setOtherTaxableIncome] = useState("5000000");

  const result = useMemo(() => {
    try {
      return simulateStockOptionTax({
        companyType,
        grantContractPricePerShareJpy: grantContractPrice || 0,
        exercisePricePerShareJpy: exercisePrice || 0,
        fairMarketValueAtExercisePerShareJpy: fairMarketValueAtExercise || 0,
        salePricePerShareJpy: alreadySold ? salePrice || 0 : undefined,
        shares: shares || 0,
        grantDate,
        exerciseDate,
        otherQualifiedExercisesJpy: otherQualifiedExercises || 0,
        otherRequirementsConfirmed,
        isBusinessConsultant,
        otherTaxableIncomeJpy: otherTaxableIncome || 0,
      });
    } catch {
      return null;
    }
  }, [
    companyType,
    grantContractPrice,
    exercisePrice,
    fairMarketValueAtExercise,
    alreadySold,
    salePrice,
    shares,
    grantDate,
    exerciseDate,
    otherQualifiedExercises,
    otherRequirementsConfirmed,
    isBusinessConsultant,
    otherTaxableIncome,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-4 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">発行会社・付与条件</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">発行会社の区分(年間上限額の判定に使用)</span>
          <select
            value={companyType}
            onChange={(e) => setCompanyType(e.target.value as StockOptionCompanyType)}
            className={inputClass}
          >
            <option value="LISTED_5Y_OR_MORE">上場会社(上限1,200万円)</option>
            <option value="UNLISTED_5Y_OR_MORE">非上場会社・設立5年以上(上限2,400万円)</option>
            <option value="UNLISTED_UNDER_5Y">非上場会社・設立5年未満(上限3,600万円)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">付与に関する決議の日</span>
          <input
            type="date"
            value={grantDate}
            onChange={(e) => setGrantDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">付与契約締結時の1株当たりの価額</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={grantContractPrice}
            onChange={(e) => setGrantContractPrice(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={otherRequirementsConfirmed}
            onChange={(e) => setOtherRequirementsConfirmed(e.target.checked)}
          />
          <span>
            その他の税制適格要件(付与対象者・大口株主等でないこと・譲渡制限・株式の管理方法)を満たす
          </span>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-4 sm:grid-cols-3 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">権利行使</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">権利行使日</span>
          <input
            type="date"
            value={exerciseDate}
            onChange={(e) => setExerciseDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">権利行使価額(1株当たり)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={exercisePrice}
            onChange={(e) => setExercisePrice(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">権利行使株数</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">権利行使時の1株当たりの時価</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={fairMarketValueAtExercise}
            onChange={(e) => setFairMarketValueAtExercise(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            その年中の他の税制適格ストックオプションの権利行使価額の合計
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={otherQualifiedExercises}
            onChange={(e) => setOtherQualifiedExercises(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={isBusinessConsultant}
            onChange={(e) => setIsBusinessConsultant(e.target.checked)}
          />
          <span>社外高度人材等との業務委託契約に基づく付与(既定は給与所得)</span>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          <span className="text-neutral-500">
            税制非適格分の権利行使益を上乗せする前の、他の所得の課税所得金額(給与所得控除等の適用後)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={otherTaxableIncome}
            onChange={(e) => setOtherTaxableIncome(e.target.value)}
            className={inputClass}
          />
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-4 sm:grid-cols-3 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">株式の売却(任意)</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={alreadySold}
            onChange={(e) => setAlreadySold(e.target.checked)}
          />
          <span>その年中に株式を売却した</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">譲渡価額(1株当たり)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            disabled={!alreadySold}
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className={inputClass}
          />
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(金額・株数は0以上、日付の形式が正しいか確認すること)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">税制適格になる株数</p>
              <p className="mt-1 text-2xl font-semibold">
                {result.qualifiedShares.toString()}株
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">税制非適格になる株数</p>
              <p className="mt-1 text-2xl font-semibold">
                {result.nonQualifiedShares.toString()}株
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">
                権利行使時の増加税額(非適格分。所得税+住民税)
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.exerciseNationalTaxIncreaseJpy.plus(result.exerciseResidentTaxIncreaseJpy))}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">税額の合計(権利行使時+売却時)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.totalTaxJpy)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm font-medium">権利行使時(非適格分)</p>
              <p className="mt-1 text-sm text-neutral-500">
                権利行使益: {yen(result.nonQualifiedExerciseGainJpy)}(
                {result.nonQualifiedExerciseIncomeType === "EMPLOYMENT"
                  ? "給与所得"
                  : "事業所得又は雑所得"}
                として総合課税)
              </p>
              <p className="text-sm text-neutral-500">
                所得税(復興特別所得税込み)の増加分: {yen(result.exerciseNationalTaxIncreaseJpy)}
              </p>
              <p className="text-sm text-neutral-500">
                住民税の増加分(一律10%): {yen(result.exerciseResidentTaxIncreaseJpy)}
              </p>
            </div>
            {result.sale && (
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-sm font-medium">株式売却時(譲渡所得。申告分離課税20.315%)</p>
                <p className="mt-1 text-sm text-neutral-500">
                  適格分の譲渡所得: {yen(result.sale.qualifiedGainJpy)}
                </p>
                <p className="text-sm text-neutral-500">
                  非適格分の譲渡所得: {yen(result.sale.nonQualifiedGainJpy)}
                </p>
                <p className="text-sm text-neutral-500">
                  課税対象額の合計: {yen(result.sale.totalTaxableGainJpy)}
                </p>
                <p className="text-sm text-neutral-500">
                  税額(所得税+住民税):{" "}
                  {yen(result.sale.nationalTaxJpy.plus(result.sale.residentTaxJpy))}
                </p>
              </div>
            )}
          </div>

          {!result.meetsExercisePriceRequirement && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              権利行使価額が付与契約締結時の1株当たりの価額を下回っているため、税制適格の要件を満たしません。
            </p>
          )}
          {!result.meetsExercisePeriodRequirement && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              権利行使日が、付与決議日後2年〜10年(設立5年未満の非上場会社は15年)の権利行使期間の範囲外です。
            </p>
          )}

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
