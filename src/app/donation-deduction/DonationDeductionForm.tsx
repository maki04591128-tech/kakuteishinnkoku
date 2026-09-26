"use client";

import { useMemo, useState } from "react";
import { deleteIncomeDeduction, saveIncomeDeduction } from "@/app/actions";
import { estimateDonationDeduction } from "@/lib/donationDeduction";
import { INCOME_TAX_BRACKETS } from "@/lib/incomeTax";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const MARGINAL_RATE_OPTIONS = [...new Set(INCOME_TAX_BRACKETS.map((b) => b.rate))];

export function DonationDeductionForm({
  year,
  registeredDeduction,
}: {
  year: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
}) {
  const [totalDonation, setTotalDonation] = useState("0");
  const [furusatoNozeiDonation, setFurusatoNozeiDonation] = useState("0");
  const [totalIncome, setTotalIncome] = useState("0");
  const [residentTaxIncomeLevied, setResidentTaxIncomeLevied] = useState("0");
  const [marginalRate, setMarginalRate] = useState("0.1");
  const [angelTaxInvestment, setAngelTaxInvestment] = useState("0");
  const [isOkinawaDesignatedCompanyStock, setIsOkinawaDesignatedCompanyStock] = useState(false);

  const result = useMemo(() => {
    try {
      return estimateDonationDeduction({
        totalDonationJpy: totalDonation || 0,
        furusatoNozeiDonationJpy: furusatoNozeiDonation || 0,
        totalIncomeJpy: totalIncome || 0,
        residentTaxIncomeLeviedJpy: residentTaxIncomeLevied || 0,
        marginalIncomeTaxRate: marginalRate || 0,
        angelTaxInvestmentJpy: angelTaxInvestment || 0,
        isOkinawaDesignatedCompanyStock,
      });
    } catch {
      return null;
    }
  }, [
    totalDonation,
    furusatoNozeiDonation,
    totalIncome,
    residentTaxIncomeLevied,
    marginalRate,
    angelTaxInvestment,
    isOkinawaDesignatedCompanyStock,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">入力</legend>
        <Field
          label="寄附金の合計額"
          helper="ふるさと納税分を含む、その年に支払った寄附金控除対象の合計額"
          value={totalDonation}
          onChange={setTotalDonation}
        />
        <Field
          label="うちふるさと納税額"
          helper="都道府県・市区町村への寄附額(住民税特例控除の対象)。寄附金の合計額以下"
          value={furusatoNozeiDonation}
          onChange={setFurusatoNozeiDonation}
        />
        <Field
          label="総所得金額等"
          helper="寄附金控除の上限(所得税40%・住民税基本控除30%)の判定に使う"
          value={totalIncome}
          onChange={setTotalIncome}
        />
        <Field
          label="住民税所得割額(概算)"
          helper="特例控除の上限(20%)判定用。/tax-estimateの試算結果を参考に入力"
          value={residentTaxIncomeLevied}
          onChange={setResidentTaxIncomeLevied}
        />
        <Field
          label="エンジェル税制(特定新規株式)の出資額"
          helper="措置法37条の13の3。特定新規中小会社への払込みによる取得価額。800万円超は自動的に800万円で頭打ちにして所得税の寄附金控除額にのみ加算(住民税には加算しない)"
          value={angelTaxInvestment}
          onChange={setAngelTaxInvestment}
        />
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isOkinawaDesignatedCompanyStock}
            onChange={(e) => setIsOkinawaDesignatedCompanyStock(e.target.checked)}
            className="mt-1"
          />
          <span>
            上記の出資先は沖縄振興特別措置法の指定会社である
            <span className="ml-1 text-xs text-neutral-500">
              (経済金融活性化特別地区内で平成26年4月1日〜令和3年3月31日の間に指定を受けた会社。上限額が800万円ではなく1,000万円になる)
            </span>
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            所得税の限界税率
            <span className="ml-1 text-xs">(/tax-estimateの試算結果を参考に選択)</span>
          </span>
          <select
            value={marginalRate}
            onChange={(e) => setMarginalRate(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {MARGINAL_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate * 100}%
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(0以上の数値、ふるさと納税額は寄附金の合計額以下)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">寄附金控除額(所得税)</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.incomeTaxDeductionJpy)}</p>
              {result.angelTaxDeemedDonationJpy.greaterThan(0) && (
                <p className="mt-1 text-xs text-neutral-500">
                  うちエンジェル税制加算分 {yen(result.angelTaxDeemedDonationJpy)}
                  (住民税には加算しない)
                </p>
              )}
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">寄附金控除額(住民税、基本控除+特例控除)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.residentTaxTotalDeductionJpy)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                内訳: 基本控除 {yen(result.residentTaxBasicDeductionJpy)} / 特例控除{" "}
                {yen(result.residentTaxSpecialDeductionJpy)}(上限{" "}
                {yen(result.residentTaxSpecialDeductionLimitJpy)})
              </p>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveIncomeDeduction}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="type" value="DONATION" />
              <input
                type="hidden"
                name="incomeTaxAmountJpy"
                value={result.incomeTaxDeductionJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxAmountJpy"
                value={result.residentTaxTotalDeductionJpy.toString()}
              />
              <input type="hidden" name="redirectPath" value="/donation-deduction" />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{year}年分の所得控除として登録する
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
                  <input type="hidden" name="type" value="DONATION" />
                  <input type="hidden" name="redirectPath" value="/donation-deduction" />
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

function Field({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">
        {label}
        {helper && <span className="ml-1 text-xs">({helper})</span>}
      </span>
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
