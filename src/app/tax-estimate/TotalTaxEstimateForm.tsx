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

function balanceLabel(value: Decimal): string {
  return value.isNegative() ? `還付見込み ${yen(value.abs())}` : `納付見込み ${yen(value)}`;
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
  defaultNonListedInvestmentTaxableGainJpy,
  defaultFuturesTaxableGainJpy,
  defaultDividendIncomeJpy,
  defaultAvailableListedStockLossForDividendJpy,
  registeredIncomeDeductions,
  totalRegisteredIncomeTaxDeductionJpy,
  incomeDeductionNotes,
  defaultResidentTaxAdjustmentDeductionJpy,
  registeredResidentTaxAdjustmentDeductionJpy,
  defaultMortgageDeductionNationalTaxCreditJpy,
  defaultMortgageDeductionResidentTaxCreditJpy,
  registeredMortgageDeduction,
  defaultDonationTaxCreditJpy,
  registeredDonationTaxCreditJpy,
  defaultDonationTaxCreditResidentTaxJpy,
  registeredDonationTaxCreditResidentTaxJpy,
  defaultForeignTaxCreditNationalTaxCreditJpy,
  defaultForeignTaxCreditResidentTaxCreditJpy,
  registeredForeignTaxCredit,
  defaultDistributionAdjustedForeignTaxCreditJpy,
  registeredDistributionAdjustedForeignTaxCreditJpy,
  defaultEarthquakeRenovationDeductionJpy,
  registeredEarthquakeRenovationDeductionJpy,
  defaultEnergySavingRenovationDeductionJpy,
  registeredEnergySavingRenovationDeductionJpy,
  defaultBarrierFreeRenovationDeductionJpy,
  registeredBarrierFreeRenovationDeductionJpy,
}: {
  defaultOtherComprehensiveIncomeJpy: number;
  defaultCryptoMiscIncomeJpy: number;
  defaultInvestmentTaxableGainJpy: number;
  /** 一般株式等(非上場株式)の当年課税対象額の初期値(赤字の場合0円に切り捨て済み) */
  defaultNonListedInvestmentTaxableGainJpy: number;
  defaultFuturesTaxableGainJpy: number;
  defaultDividendIncomeJpy: number;
  defaultAvailableListedStockLossForDividendJpy: number;
  /** 各所得控除試算画面で登録済みの控除額の内訳(区分ごと) */
  registeredIncomeDeductions: RegisteredIncomeDeductionEntry[];
  /** 登録済みの所得控除の合計額(所得税ベース。defaultOtherComprehensiveIncomeJpyの算出に使用済み) */
  totalRegisteredIncomeTaxDeductionJpy: number;
  /** 合計額の算出にあたっての注記(医療費控除とセルフメディケーション税制が両方登録されている場合等) */
  incomeDeductionNotes: string[];
  /** `/resident-tax-adjustment-deduction`で登録済みの調整控除額の初期値 */
  defaultResidentTaxAdjustmentDeductionJpy: number;
  /** `/resident-tax-adjustment-deduction`で登録済みの調整控除額(参考表示。未登録ならnull) */
  registeredResidentTaxAdjustmentDeductionJpy: number | null;
  /** `/mortgage-deduction`で登録済みの住宅ローン控除額(所得税分)の初期値 */
  defaultMortgageDeductionNationalTaxCreditJpy: number;
  /** `/mortgage-deduction`で登録済みの住宅ローン控除額(住民税分)の初期値 */
  defaultMortgageDeductionResidentTaxCreditJpy: number;
  /** `/mortgage-deduction`で登録済みの住宅ローン控除額(参考表示。未登録ならnull) */
  registeredMortgageDeduction: { nationalTaxCreditJpy: number; residentTaxCreditJpy: number } | null;
  /** `/donation-tax-credit`で登録済みの寄附金特別控除額(所得税分)の初期値 */
  defaultDonationTaxCreditJpy: number;
  /** `/donation-tax-credit`で登録済みの寄附金特別控除額(所得税分。参考表示。未登録ならnull) */
  registeredDonationTaxCreditJpy: number | null;
  /** `/donation-tax-credit`で登録済みの住民税の寄附金控除(基本控除)額の初期値 */
  defaultDonationTaxCreditResidentTaxJpy: number;
  /** `/donation-tax-credit`で登録済みの住民税の寄附金控除(基本控除)額(参考表示。未登録ならnull) */
  registeredDonationTaxCreditResidentTaxJpy: number | null;
  /** `/foreign-tax-credit`で登録済みの外国税額控除額(所得税・復興特別所得税分)の初期値 */
  defaultForeignTaxCreditNationalTaxCreditJpy: number;
  /** `/foreign-tax-credit`で登録済みの外国税額控除額(住民税分)の初期値 */
  defaultForeignTaxCreditResidentTaxCreditJpy: number;
  /** `/foreign-tax-credit`で登録済みの外国税額控除額(参考表示。未登録ならnull) */
  registeredForeignTaxCredit: { nationalTaxCreditJpy: number; residentTaxCreditJpy: number } | null;
  /** `/distribution-adjusted-foreign-tax-credit`で登録済みの分配時調整外国税相当額控除額の初期値 */
  defaultDistributionAdjustedForeignTaxCreditJpy: number;
  /** `/distribution-adjusted-foreign-tax-credit`で登録済みの控除額(参考表示。未登録ならnull) */
  registeredDistributionAdjustedForeignTaxCreditJpy: number | null;
  /** `/earthquake-renovation-deduction`で登録済みの住宅耐震改修特別控除額の初期値 */
  defaultEarthquakeRenovationDeductionJpy: number;
  /** `/earthquake-renovation-deduction`で登録済みの控除額(参考表示。未登録ならnull) */
  registeredEarthquakeRenovationDeductionJpy: number | null;
  /** `/energy-saving-renovation-deduction`で登録済みの省エネ改修工事の住宅特定改修特別税額控除額の初期値 */
  defaultEnergySavingRenovationDeductionJpy: number;
  /** `/energy-saving-renovation-deduction`で登録済みの控除額(参考表示。未登録ならnull) */
  registeredEnergySavingRenovationDeductionJpy: number | null;
  /** `/barrier-free-renovation-deduction`で登録済みのバリアフリー改修工事の住宅特定改修特別税額控除額の初期値 */
  defaultBarrierFreeRenovationDeductionJpy: number;
  /** `/barrier-free-renovation-deduction`で登録済みの控除額(参考表示。未登録ならnull) */
  registeredBarrierFreeRenovationDeductionJpy: number | null;
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
  const [nonListedInvestmentTaxableGainJpy, setNonListedInvestmentTaxableGainJpy] = useState(
    String(defaultNonListedInvestmentTaxableGainJpy),
  );
  const [futuresTaxableGainJpy, setFuturesTaxableGainJpy] = useState(
    String(defaultFuturesTaxableGainJpy),
  );
  const [dividendIncomeJpy, setDividendIncomeJpy] = useState(String(defaultDividendIncomeJpy));
  const [availableListedStockLossForDividendJpy, setAvailableListedStockLossForDividendJpy] =
    useState(String(defaultAvailableListedStockLossForDividendJpy));
  const [dividendMethod, setDividendMethod] = useState<DividendTaxMethod | "AUTO">("AUTO");
  const [residentTaxAdjustmentDeductionJpy, setResidentTaxAdjustmentDeductionJpy] = useState(
    String(defaultResidentTaxAdjustmentDeductionJpy),
  );
  const [mortgageDeductionNationalTaxCreditJpy, setMortgageDeductionNationalTaxCreditJpy] =
    useState(String(defaultMortgageDeductionNationalTaxCreditJpy));
  const [mortgageDeductionResidentTaxCreditJpy, setMortgageDeductionResidentTaxCreditJpy] =
    useState(String(defaultMortgageDeductionResidentTaxCreditJpy));
  const [donationTaxCreditJpy, setDonationTaxCreditJpy] = useState(
    String(defaultDonationTaxCreditJpy),
  );
  const [donationTaxCreditResidentTaxJpy, setDonationTaxCreditResidentTaxJpy] = useState(
    String(defaultDonationTaxCreditResidentTaxJpy),
  );
  const [foreignTaxCreditNationalTaxCreditJpy, setForeignTaxCreditNationalTaxCreditJpy] =
    useState(String(defaultForeignTaxCreditNationalTaxCreditJpy));
  const [foreignTaxCreditResidentTaxCreditJpy, setForeignTaxCreditResidentTaxCreditJpy] =
    useState(String(defaultForeignTaxCreditResidentTaxCreditJpy));
  const [
    distributionAdjustedForeignTaxCreditJpy,
    setDistributionAdjustedForeignTaxCreditJpy,
  ] = useState(String(defaultDistributionAdjustedForeignTaxCreditJpy));
  const [earthquakeRenovationDeductionJpy, setEarthquakeRenovationDeductionJpy] = useState(
    String(defaultEarthquakeRenovationDeductionJpy),
  );
  const [energySavingRenovationDeductionJpy, setEnergySavingRenovationDeductionJpy] = useState(
    String(defaultEnergySavingRenovationDeductionJpy),
  );
  const [barrierFreeRenovationDeductionJpy, setBarrierFreeRenovationDeductionJpy] = useState(
    String(defaultBarrierFreeRenovationDeductionJpy),
  );
  const [withheldNationalTaxJpy, setWithheldNationalTaxJpy] = useState("0");
  const [withheldResidentTaxJpy, setWithheldResidentTaxJpy] = useState("0");
  const [estimatedTaxPrepaymentJpy, setEstimatedTaxPrepaymentJpy] = useState("0");
  const [residentTaxPerCapitaLeviesJpy, setResidentTaxPerCapitaLeviesJpy] = useState("0");

  const result = useMemo(() => {
    try {
      return estimateTotalTax({
        otherComprehensiveIncomeJpy:
          otherComprehensiveIncomeJpy === "" ? 0 : otherComprehensiveIncomeJpy,
        cryptoMiscIncomeJpy: cryptoMiscIncomeJpy === "" ? 0 : cryptoMiscIncomeJpy,
        investmentTaxableGainJpy:
          investmentTaxableGainJpy === "" ? 0 : investmentTaxableGainJpy,
        nonListedInvestmentTaxableGainJpy:
          nonListedInvestmentTaxableGainJpy === "" ? 0 : nonListedInvestmentTaxableGainJpy,
        futuresTaxableGainJpy: futuresTaxableGainJpy === "" ? 0 : futuresTaxableGainJpy,
        dividendIncomeJpy: dividendIncomeJpy === "" ? 0 : dividendIncomeJpy,
        dividendMethod: dividendMethod === "AUTO" ? undefined : dividendMethod,
        availableListedStockLossForDividendJpy:
          availableListedStockLossForDividendJpy === ""
            ? 0
            : availableListedStockLossForDividendJpy,
        residentTaxAdjustmentDeductionJpy:
          residentTaxAdjustmentDeductionJpy === "" ? 0 : residentTaxAdjustmentDeductionJpy,
        mortgageDeductionNationalTaxCreditJpy:
          mortgageDeductionNationalTaxCreditJpy === ""
            ? 0
            : mortgageDeductionNationalTaxCreditJpy,
        mortgageDeductionResidentTaxCreditJpy:
          mortgageDeductionResidentTaxCreditJpy === ""
            ? 0
            : mortgageDeductionResidentTaxCreditJpy,
        donationTaxCreditJpy: donationTaxCreditJpy === "" ? 0 : donationTaxCreditJpy,
        donationTaxCreditResidentTaxJpy:
          donationTaxCreditResidentTaxJpy === "" ? 0 : donationTaxCreditResidentTaxJpy,
        earthquakeRenovationDeductionJpy:
          earthquakeRenovationDeductionJpy === "" ? 0 : earthquakeRenovationDeductionJpy,
        energySavingRenovationDeductionJpy:
          energySavingRenovationDeductionJpy === "" ? 0 : energySavingRenovationDeductionJpy,
        barrierFreeRenovationDeductionJpy:
          barrierFreeRenovationDeductionJpy === "" ? 0 : barrierFreeRenovationDeductionJpy,
        foreignTaxCreditNationalTaxCreditJpy:
          foreignTaxCreditNationalTaxCreditJpy === ""
            ? 0
            : foreignTaxCreditNationalTaxCreditJpy,
        foreignTaxCreditResidentTaxCreditJpy:
          foreignTaxCreditResidentTaxCreditJpy === ""
            ? 0
            : foreignTaxCreditResidentTaxCreditJpy,
        distributionAdjustedForeignTaxCreditJpy:
          distributionAdjustedForeignTaxCreditJpy === ""
            ? 0
            : distributionAdjustedForeignTaxCreditJpy,
        withheldNationalTaxJpy: withheldNationalTaxJpy === "" ? 0 : withheldNationalTaxJpy,
        withheldResidentTaxJpy: withheldResidentTaxJpy === "" ? 0 : withheldResidentTaxJpy,
        estimatedTaxPrepaymentJpy:
          estimatedTaxPrepaymentJpy === "" ? 0 : estimatedTaxPrepaymentJpy,
        residentTaxPerCapitaLeviesJpy:
          residentTaxPerCapitaLeviesJpy === "" ? 0 : residentTaxPerCapitaLeviesJpy,
      });
    } catch {
      return null;
    }
  }, [
    otherComprehensiveIncomeJpy,
    cryptoMiscIncomeJpy,
    investmentTaxableGainJpy,
    nonListedInvestmentTaxableGainJpy,
    futuresTaxableGainJpy,
    dividendIncomeJpy,
    dividendMethod,
    availableListedStockLossForDividendJpy,
    residentTaxAdjustmentDeductionJpy,
    mortgageDeductionNationalTaxCreditJpy,
    mortgageDeductionResidentTaxCreditJpy,
    donationTaxCreditJpy,
    donationTaxCreditResidentTaxJpy,
    earthquakeRenovationDeductionJpy,
    energySavingRenovationDeductionJpy,
    barrierFreeRenovationDeductionJpy,
    foreignTaxCreditNationalTaxCreditJpy,
    foreignTaxCreditResidentTaxCreditJpy,
    distributionAdjustedForeignTaxCreditJpy,
    withheldNationalTaxJpy,
    withheldResidentTaxJpy,
    estimatedTaxPrepaymentJpy,
    residentTaxPerCapitaLeviesJpy,
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
          label="譲渡所得等(一般株式等・非上場株式・繰越控除制度なし)"
          value={nonListedInvestmentTaxableGainJpy}
          onChange={setNonListedInvestmentTaxableGainJpy}
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
          label={`住民税の調整控除(税額控除・住民税所得割のみ)${
            registeredResidentTaxAdjustmentDeductionJpy !== null
              ? " — 初期値は/resident-tax-adjustment-deductionの登録値"
              : ""
          }`}
          value={residentTaxAdjustmentDeductionJpy}
          onChange={setResidentTaxAdjustmentDeductionJpy}
        />
      </div>
      {registeredResidentTaxAdjustmentDeductionJpy !== null && (
        <p className="text-xs text-neutral-500">
          /resident-tax-adjustment-deductionで登録済み:{" "}
          {yen(registeredResidentTaxAdjustmentDeductionJpy)}
        </p>
      )}

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={`寄附金特別控除(政党等・認定NPO法人等・公益社団法人等・税額控除・所得税分)${
            registeredDonationTaxCreditJpy !== null
              ? " — 初期値は/donation-tax-creditの登録値"
              : ""
          }`}
          value={donationTaxCreditJpy}
          onChange={setDonationTaxCreditJpy}
        />
        <Field
          label={`寄附金特別控除(住民税の寄附金控除(基本控除)分・条例指定分のみ)${
            registeredDonationTaxCreditResidentTaxJpy !== null
              ? " — 初期値は/donation-tax-creditの登録値"
              : ""
          }`}
          value={donationTaxCreditResidentTaxJpy}
          onChange={setDonationTaxCreditResidentTaxJpy}
        />
      </div>
      {(registeredDonationTaxCreditJpy !== null ||
        registeredDonationTaxCreditResidentTaxJpy !== null) && (
        <p className="text-xs text-neutral-500">
          /donation-tax-creditで登録済み: 所得税分 {yen(registeredDonationTaxCreditJpy ?? 0)} /
          住民税分 {yen(registeredDonationTaxCreditResidentTaxJpy ?? 0)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={`住宅耐震改修特別控除(税額控除・所得税分のみ。住民税に相当する控除は無し)${
            registeredEarthquakeRenovationDeductionJpy !== null
              ? " — 初期値は/earthquake-renovation-deductionの登録値"
              : ""
          }`}
          value={earthquakeRenovationDeductionJpy}
          onChange={setEarthquakeRenovationDeductionJpy}
        />
      </div>
      {registeredEarthquakeRenovationDeductionJpy !== null && (
        <p className="text-xs text-neutral-500">
          /earthquake-renovation-deductionで登録済み:{" "}
          {yen(registeredEarthquakeRenovationDeductionJpy)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={`省エネ改修工事の住宅特定改修特別税額控除(税額控除・所得税分のみ。住民税に相当する控除は無し)${
            registeredEnergySavingRenovationDeductionJpy !== null
              ? " — 初期値は/energy-saving-renovation-deductionの登録値"
              : ""
          }`}
          value={energySavingRenovationDeductionJpy}
          onChange={setEnergySavingRenovationDeductionJpy}
        />
      </div>
      {registeredEnergySavingRenovationDeductionJpy !== null && (
        <p className="text-xs text-neutral-500">
          /energy-saving-renovation-deductionで登録済み:{" "}
          {yen(registeredEnergySavingRenovationDeductionJpy)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={`バリアフリー改修工事の住宅特定改修特別税額控除(税額控除・所得税分のみ。住民税に相当する控除は無し)${
            registeredBarrierFreeRenovationDeductionJpy !== null
              ? " — 初期値は/barrier-free-renovation-deductionの登録値"
              : ""
          }`}
          value={barrierFreeRenovationDeductionJpy}
          onChange={setBarrierFreeRenovationDeductionJpy}
        />
      </div>
      {registeredBarrierFreeRenovationDeductionJpy !== null && (
        <p className="text-xs text-neutral-500">
          /barrier-free-renovation-deductionで登録済み:{" "}
          {yen(registeredBarrierFreeRenovationDeductionJpy)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={`外国税額控除(税額控除・所得税・復興特別所得税分)${
            registeredForeignTaxCredit !== null ? " — 初期値は/foreign-tax-creditの登録値" : ""
          }`}
          value={foreignTaxCreditNationalTaxCreditJpy}
          onChange={setForeignTaxCreditNationalTaxCreditJpy}
        />
        <Field
          label="外国税額控除(税額控除・住民税分)"
          value={foreignTaxCreditResidentTaxCreditJpy}
          onChange={setForeignTaxCreditResidentTaxCreditJpy}
        />
      </div>
      {registeredForeignTaxCredit !== null && (
        <p className="text-xs text-neutral-500">
          /foreign-tax-creditで登録済み: 所得税等{" "}
          {yen(registeredForeignTaxCredit.nationalTaxCreditJpy)} / 住民税{" "}
          {yen(registeredForeignTaxCredit.residentTaxCreditJpy)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={`分配時調整外国税相当額控除(税額控除・所得税分。住民税分は無し)${
            registeredDistributionAdjustedForeignTaxCreditJpy !== null
              ? " — 初期値は/distribution-adjusted-foreign-tax-creditの登録値"
              : ""
          }`}
          value={distributionAdjustedForeignTaxCreditJpy}
          onChange={setDistributionAdjustedForeignTaxCreditJpy}
        />
      </div>
      {registeredDistributionAdjustedForeignTaxCreditJpy !== null && (
        <p className="text-xs text-neutral-500">
          /distribution-adjusted-foreign-tax-creditで登録済み:{" "}
          {yen(registeredDistributionAdjustedForeignTaxCreditJpy)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="源泉徴収税額(所得税・復興特別所得税分。給与・配当・特定口座内の譲渡益等の合計)"
          value={withheldNationalTaxJpy}
          onChange={setWithheldNationalTaxJpy}
        />
        <Field
          label="源泉徴収済みの住民税相当額(特定口座(源泉徴収あり)分。通常は税抜金額の5%)"
          value={withheldResidentTaxJpy}
          onChange={setWithheldResidentTaxJpy}
        />
        <Field
          label="予定納税額(所得税・復興特別所得税の第1期・第2期の納付済み合計額)"
          value={estimatedTaxPrepaymentJpy}
          onChange={setEstimatedTaxPrepaymentJpy}
        />
        <Field
          label="住民税の均等割(定額部分。標準税率は年5,000円程度。住民税決定通知書等で確認した金額)"
          value={residentTaxPerCapitaLeviesJpy}
          onChange={setResidentTaxPerCapitaLeviesJpy}
        />
      </div>

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
            {result.residentTaxAdjustmentDeductionAppliedJpy.greaterThan(0) && (
              <p className="mt-1 text-xs text-neutral-400">
                − 住民税の調整控除 {yen(result.residentTaxAdjustmentDeductionAppliedJpy)}
                (住民税所得割のみ。所得税分は無し)
              </p>
            )}
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
            {(result.donationTaxCreditAppliedJpy.greaterThan(0) ||
              result.donationTaxCreditResidentTaxAppliedJpy.greaterThan(0)) && (
              <p className="mt-1 text-xs text-neutral-400">
                − 寄附金特別控除 {yen(
                  result.donationTaxCreditAppliedJpy.plus(
                    result.donationTaxCreditResidentTaxAppliedJpy,
                  ),
                )}
                (所得税分 {yen(result.donationTaxCreditAppliedJpy)} / 住民税分{" "}
                {yen(result.donationTaxCreditResidentTaxAppliedJpy)})
              </p>
            )}
            {result.earthquakeRenovationDeductionAppliedJpy.greaterThan(0) && (
              <p className="mt-1 text-xs text-neutral-400">
                − 住宅耐震改修特別控除{" "}
                {yen(result.earthquakeRenovationDeductionAppliedJpy)}(所得税分のみ)
              </p>
            )}
            {result.energySavingRenovationDeductionAppliedJpy.greaterThan(0) && (
              <p className="mt-1 text-xs text-neutral-400">
                − 省エネ改修工事の住宅特定改修特別税額控除{" "}
                {yen(result.energySavingRenovationDeductionAppliedJpy)}(所得税分のみ)
              </p>
            )}
            {result.barrierFreeRenovationDeductionAppliedJpy.greaterThan(0) && (
              <p className="mt-1 text-xs text-neutral-400">
                − バリアフリー改修工事の住宅特定改修特別税額控除{" "}
                {yen(result.barrierFreeRenovationDeductionAppliedJpy)}(所得税分のみ)
              </p>
            )}
            {(result.foreignTaxCreditNationalTaxAppliedJpy.greaterThan(0) ||
              result.foreignTaxCreditResidentTaxAppliedJpy.greaterThan(0)) && (
              <p className="mt-1 text-xs text-neutral-400">
                − 外国税額控除 {yen(
                  result.foreignTaxCreditNationalTaxAppliedJpy.plus(
                    result.foreignTaxCreditResidentTaxAppliedJpy,
                  ),
                )}
                (所得税等 {yen(result.foreignTaxCreditNationalTaxAppliedJpy)} / 住民税{" "}
                {yen(result.foreignTaxCreditResidentTaxAppliedJpy)})
              </p>
            )}
            {result.distributionAdjustedForeignTaxCreditAppliedJpy.greaterThan(0) && (
              <p className="mt-1 text-xs text-neutral-400">
                − 分配時調整外国税相当額控除{" "}
                {yen(result.distributionAdjustedForeignTaxCreditAppliedJpy)}(所得税分のみ)
              </p>
            )}
            {result.residentTaxPerCapitaLeviesJpy.greaterThan(0) && (
              <p className="mt-1 text-xs text-neutral-400">
                住民税額には均等割 {yen(result.residentTaxPerCapitaLeviesJpy)} を加算済み(所得割とは別に定額で課される部分)
              </p>
            )}
          </div>

          {(result.withheldNationalTaxJpy.greaterThan(0) ||
            result.withheldResidentTaxJpy.greaterThan(0) ||
            result.estimatedTaxPrepaymentJpy.greaterThan(0)) && (
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">
                納付・還付見込み額(源泉徴収税額・予定納税額との差額)
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {balanceLabel(result.totalTaxBalanceJpy)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                所得税等: {balanceLabel(result.nationalTaxBalanceJpy)}(税額 {" "}
                {yen(result.totalNationalTaxJpy)} − 源泉徴収 {yen(result.withheldNationalTaxJpy)}
                {result.estimatedTaxPrepaymentJpy.greaterThan(0) &&
                  ` − 予定納税 ${yen(result.estimatedTaxPrepaymentJpy)}`}
                )
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                住民税: {balanceLabel(result.residentTaxBalanceJpy)}(税額 {" "}
                {yen(result.totalResidentTaxJpy)} − 特別徴収 {yen(result.withheldResidentTaxJpy)})
              </p>
            </div>
          )}

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
              title="譲渡所得等(一般株式等・非上場株式・申告分離課税)"
              nationalTaxJpy={result.nonListedInvestmentNationalTaxJpy}
              residentTaxJpy={result.nonListedInvestmentResidentTaxJpy}
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
