"use client";

import { useMemo, useState } from "react";
import type { Decimal } from "decimal.js";
import { estimateTotalTax } from "@/lib/taxEstimate";
import type { DividendTaxMethod } from "@/lib/investment/dividendTaxSimulation";

const METHOD_LABEL: Record<DividendTaxMethod, string> = {
  COMPREHENSIVE: "総合課税",
  SEPARATE: "申告分離課税",
  NO_FILING: "申告不要",
};

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export interface RegisteredIncomeDeductionEntry {
  label: string;
  incomeTaxAmountJpy: number;
  residentTaxAmountJpy: number;
}

export function TotalTaxEstimateForm({
  defaultOtherComprehensiveIncomeJpy,
  defaultCryptoMiscIncomeJpy,
  defaultInvestmentTaxableGainJpy,
  defaultFuturesTaxableGainJpy,
  defaultDividendIncomeJpy,
  defaultAvailableListedStockLossForDividendJpy,
  registeredIncomeDeductions,
  totalRegisteredIncomeTaxDeductionJpy,
  incomeDeductionNotes,
  defaultMortgageDeductionNationalTaxCreditJpy,
  defaultMortgageDeductionResidentTaxCreditJpy,
  registeredMortgageDeduction,
}: {
  defaultOtherComprehensiveIncomeJpy: number;
  defaultCryptoMiscIncomeJpy: number;
  defaultInvestmentTaxableGainJpy: number;
  defaultFuturesTaxableGainJpy: number;
  defaultDividendIncomeJpy: number;
  defaultAvailableListedStockLossForDividendJpy: number;
  /** 各所得控除試算画面で登録済みの控除額の内訳(区分ごと) */
  registeredIncomeDeductions: RegisteredIncomeDeductionEntry[];
  /** 登録済みの所得控除の合計額(所得税ベース。defaultOtherComprehensiveIncomeJpyの算出に使用済み) */
  totalRegisteredIncomeTaxDeductionJpy: number;
  /** 合計額の算出にあたっての注記(医療費控除とセルフメディケーション税制が両方登録されている場合等) */
  incomeDeductionNotes: string[];
  /** `/mortgage-deduction`で登録済みの住宅ローン控除額(所得税分)の初期値 */
  defaultMortgageDeductionNationalTaxCreditJpy: number;
  /** `/mortgage-deduction`で登録済みの住宅ローン控除額(住民税分)の初期値 */
  defaultMortgageDeductionResidentTaxCreditJpy: number;
  /** `/mortgage-deduction`で登録済みの住宅ローン控除額(参考表示。未登録ならnull) */
  registeredMortgageDeduction: { nationalTaxCreditJpy: number; residentTaxCreditJpy: number } | null;
}) {
  const [otherComprehensiveIncomeJpy, setOtherComprehensiveIncomeJpy] = useState(
    String(defaultOtherComprehensiveIncomeJpy),
  );
  const [cryptoMiscIncomeJpy, setCryptoMiscIncomeJpy] = useState(
    String(defaultCryptoMiscIncomeJpy),
  );
  const [investmentTaxableGainJpy, setInvestmentTaxableGainJpy] = useState(
    String(defaultInvestmentTaxableGainJpy),
  );
  const [futuresTaxableGainJpy, setFuturesTaxableGainJpy] = useState(
    String(defaultFuturesTaxableGainJpy),
  );
  const [dividendIncomeJpy, setDividendIncomeJpy] = useState(String(defaultDividendIncomeJpy));
  const [availableListedStockLossForDividendJpy, setAvailableListedStockLossForDividendJpy] =
    useState(String(defaultAvailableListedStockLossForDividendJpy));
  const [dividendMethod, setDividendMethod] = useState<DividendTaxMethod | "AUTO">("AUTO");
  const [mortgageDeductionNationalTaxCreditJpy, setMortgageDeductionNationalTaxCreditJpy] =
    useState(String(defaultMortgageDeductionNationalTaxCreditJpy));
  const [mortgageDeductionResidentTaxCreditJpy, setMortgageDeductionResidentTaxCreditJpy] =
    useState(String(defaultMortgageDeductionResidentTaxCreditJpy));

  const result = useMemo(() => {
    try {
      return estimateTotalTax({
        otherComprehensiveIncomeJpy:
          otherComprehensiveIncomeJpy === "" ? 0 : otherComprehensiveIncomeJpy,
        cryptoMiscIncomeJpy: cryptoMiscIncomeJpy === "" ? 0 : cryptoMiscIncomeJpy,
        investmentTaxableGainJpy:
          investmentTaxableGainJpy === "" ? 0 : investmentTaxableGainJpy,
        futuresTaxableGainJpy: futuresTaxableGainJpy === "" ? 0 : futuresTaxableGainJpy,
        dividendIncomeJpy: dividendIncomeJpy === "" ? 0 : dividendIncomeJpy,
        dividendMethod: dividendMethod === "AUTO" ? undefined : dividendMethod,
        availableListedStockLossForDividendJpy:
          availableListedStockLossForDividendJpy === ""
            ? 0
            : availableListedStockLossForDividendJpy,
        mortgageDeductionNationalTaxCreditJpy:
          mortgageDeductionNationalTaxCreditJpy === ""
            ? 0
            : mortgageDeductionNationalTaxCreditJpy,
        mortgageDeductionResidentTaxCreditJpy:
          mortgageDeductionResidentTaxCreditJpy === ""
            ? 0
            : mortgageDeductionResidentTaxCreditJpy,
      });
    } catch {
      return null;
    }
  }, [
    otherComprehensiveIncomeJpy,
    cryptoMiscIncomeJpy,
    investmentTaxableGainJpy,
    futuresTaxableGainJpy,
    dividendIncomeJpy,
    dividendMethod,
    availableListedStockLossForDividendJpy,
    mortgageDeductionNationalTaxCreditJpy,
    mortgageDeductionResidentTaxCreditJpy,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label={`給与所得等の課税所得金額(所得控除後・暗号資産以外)${
            totalRegisteredIncomeTaxDeductionJpy > 0
              ? ` — 初期値は登録済み所得控除 ${yen(totalRegisteredIncomeTaxDeductionJpy)}を差し引き済み`
              : ""
          }`}
          value={otherComprehensiveIncomeJpy}
          onChange={setOtherComprehensiveIncomeJpy}
        />
        <Field
          label="雑所得(暗号資産)"
          value={cryptoMiscIncomeJpy}
          onChange={setCryptoMiscIncomeJpy}
        />
        <Field
          label="譲渡所得(株式等・繰越控除後)"
          value={investmentTaxableGainJpy}
          onChange={setInvestmentTaxableGainJpy}
        />
        <Field
          label="雑所得等(先物取引・FX・繰越控除後)"
          value={futuresTaxableGainJpy}
          onChange={setFuturesTaxableGainJpy}
        />
        <Field
          label="配当所得金額(源泉徴収前・年間合計)"
          value={dividendIncomeJpy}
          onChange={setDividendIncomeJpy}
        />
        <Field
          label="配当所得と損益通算できる株式等の譲渡損失"
          value={availableListedStockLossForDividendJpy}
          onChange={setAvailableListedStockLossForDividendJpy}
        />
      </div>

      {registeredIncomeDeductions.length > 0 && (
        <div className="rounded-md bg-neutral-50 p-3 text-xs text-neutral-500 dark:bg-neutral-900">
          <p>
            登録済みの所得控除(参考。「給与所得等の課税所得金額」の初期値の算出に使用済み):
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {registeredIncomeDeductions.map((entry) => (
              <li key={entry.label}>
                {entry.label}: 所得税 {yen(entry.incomeTaxAmountJpy)}
                {entry.incomeTaxAmountJpy !== entry.residentTaxAmountJpy &&
                  ` / 住民税 ${yen(entry.residentTaxAmountJpy)}`}
              </li>
            ))}
          </ul>
          {incomeDeductionNotes.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-600 dark:text-amber-500">
              {incomeDeductionNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm sm:w-64">
        <span className="text-neutral-500">配当所得の課税方式</span>
        <select
          value={dividendMethod}
          onChange={(e) => setDividendMethod(e.target.value as DividendTaxMethod | "AUTO")}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="AUTO">自動選択(最も有利な方式)</option>
          <option value="COMPREHENSIVE">総合課税</option>
          <option value="SEPARATE">申告分離課税</option>
          <option value="NO_FILING">申告不要</option>
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={`住宅ローン控除(税額控除・所得税分)${
            registeredMortgageDeduction !== null ? " — 初期値は/mortgage-deductionの登録値" : ""
          }`}
          value={mortgageDeductionNationalTaxCreditJpy}
          onChange={setMortgageDeductionNationalTaxCreditJpy}
        />
        <Field
          label="住宅ローン控除(税額控除・住民税分)"
          value={mortgageDeductionResidentTaxCreditJpy}
          onChange={setMortgageDeductionResidentTaxCreditJpy}
        />
      </div>
      {registeredMortgageDeduction !== null && (
        <p className="text-xs text-neutral-500">
          /mortgage-deductionで登録済み: 所得税 {yen(registeredMortgageDeduction.nationalTaxCreditJpy)} /
          住民税 {yen(registeredMortgageDeduction.residentTaxCreditJpy)}
        </p>
      )}

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-6 dark:border-white">
            <p className="text-sm text-neutral-500">合計税額(所得税・復興特別所得税・住民税)</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.totalTaxJpy)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              所得税(復興特別所得税を含む) {yen(result.totalNationalTaxJpy)} + 住民税{" "}
              {yen(result.totalResidentTaxJpy)}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              配当所得の課税方式: {METHOD_LABEL[result.dividendMethodUsed]}
              {result.dividendMethodUsed === result.dividend.recommendedMethod
                ? "(最も有利)"
                : ""}
            </p>
            {(result.mortgageDeductionNationalTaxAppliedJpy.greaterThan(0) ||
              result.mortgageDeductionResidentTaxAppliedJpy.greaterThan(0)) && (
              <p className="mt-1 text-xs text-neutral-400">
                住宅ローン控除適用前 {yen(
                  result.totalNationalTaxBeforeMortgageDeductionJpy.plus(
                    result.totalResidentTaxBeforeMortgageDeductionJpy,
                  ),
                )}{" "}
                − 住宅ローン控除 {yen(
                  result.mortgageDeductionNationalTaxAppliedJpy.plus(
                    result.mortgageDeductionResidentTaxAppliedJpy,
                  ),
                )}
                (所得税 {yen(result.mortgageDeductionNationalTaxAppliedJpy)} / 住民税{" "}
                {yen(result.mortgageDeductionResidentTaxAppliedJpy)})
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BreakdownCard
              title="総合課税(給与所得等+暗号資産の雑所得)"
              nationalTaxJpy={result.comprehensiveNationalTaxJpy}
              residentTaxJpy={result.comprehensiveResidentTaxJpy}
            />
            <BreakdownCard
              title={`配当所得(${METHOD_LABEL[result.dividendMethodUsed]})`}
              nationalTaxJpy={result.dividendResultUsed.nationalTaxJpy}
              residentTaxJpy={result.dividendResultUsed.residentTaxJpy}
            />
            <BreakdownCard
              title="譲渡所得(株式等・申告分離課税)"
              nationalTaxJpy={result.investmentNationalTaxJpy}
              residentTaxJpy={result.investmentResidentTaxJpy}
            />
            <BreakdownCard
              title="雑所得等(先物取引・FX・申告分離課税)"
              nationalTaxJpy={result.futuresNationalTaxJpy}
              residentTaxJpy={result.futuresResidentTaxJpy}
            />
          </div>

          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500">
              ふるさと納税(寄附金控除)の年間上限額の目安(自己負担2,000円)
            </p>
            <p className="mt-1 text-xl font-semibold">
              {yen(result.furusatoNozei.fullDeductionDonationLimitJpy)}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              住民税所得割額(概算) {yen(result.furusatoNozei.residentTaxIncomeLeviedJpy)} ・
              所得税の限界税率{" "}
              {result.furusatoNozei.marginalIncomeTaxRate.times(100).toNumber()}%
            </p>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
            {result.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
            {result.furusatoNozei.notes.map((note, i) => (
              <li key={`furusato-${i}`}>{note}</li>
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

function BreakdownCard({
  title,
  nationalTaxJpy,
  residentTaxJpy,
}: {
  title: string;
  nationalTaxJpy: Decimal;
  residentTaxJpy: Decimal;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-1 text-xl font-semibold">{yen(nationalTaxJpy.plus(residentTaxJpy))}</p>
      <p className="mt-1 text-xs text-neutral-400">
        所得税 {yen(nationalTaxJpy)} + 住民税 {yen(residentTaxJpy)}
      </p>
    </div>
  );
}
