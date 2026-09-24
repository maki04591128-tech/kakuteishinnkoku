"use client";

import { useMemo, useState } from "react";
import { saveDonationTaxCreditRecord } from "@/app/actions";
import {
  DONATION_TAX_CREDIT_CATEGORY_LABELS,
  type DonationTaxCreditCategory,
  compareDonationTaxTreatment,
  estimateDonationTaxCredit,
} from "@/lib/donationTaxCredit";
import { INCOME_TAX_BRACKETS } from "@/lib/incomeTax";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const MARGINAL_RATE_OPTIONS = [...new Set(INCOME_TAX_BRACKETS.map((b) => b.rate))];

const COMPARISON_CATEGORY_OPTIONS: DonationTaxCreditCategory[] = [
  "POLITICAL_PARTY",
  "CERTIFIED_NPO",
  "PUBLIC_INTEREST_CORPORATION",
];

const RECOMMENDATION_LABELS: Record<string, string> = {
  TAX_CREDIT: "特別控除(税額控除)の方が有利",
  INCOME_DEDUCTION: "通常の寄附金控除(所得控除)の方が有利",
  EITHER: "どちらでも同額(差なし)",
};

export function DonationTaxCreditForm({
  taxYear,
  registeredRecord,
}: {
  taxYear: number;
  /** `/tax-estimate`と連携するため既に登録済みの寄附金特別控除額(未登録ならnull) */
  registeredRecord: {
    taxYear: number;
    totalTaxCreditJpy: number;
    residentTaxBasicDeductionJpy: number;
  } | null;
}) {
  const [politicalPartyDonation, setPoliticalPartyDonation] = useState("0");
  const [certifiedNpoDonation, setCertifiedNpoDonation] = useState("0");
  const [publicInterestCorporationDonation, setPublicInterestCorporationDonation] = useState("0");
  const [totalIncome, setTotalIncome] = useState("0");
  const [incomeTaxBeforeCredit, setIncomeTaxBeforeCredit] = useState("0");
  const [marginalRate, setMarginalRate] = useState("0.1");
  const [certifiedNpoOrdinanceDesignated, setCertifiedNpoOrdinanceDesignated] = useState(false);
  const [publicInterestCorporationOrdinanceDesignated, setPublicInterestCorporationOrdinanceDesignated] =
    useState(false);
  const [comparisonCategory, setComparisonCategory] =
    useState<DonationTaxCreditCategory>("CERTIFIED_NPO");

  const result = useMemo(() => {
    try {
      return estimateDonationTaxCredit({
        politicalPartyDonationJpy: politicalPartyDonation || 0,
        certifiedNpoDonationJpy: certifiedNpoDonation || 0,
        publicInterestCorporationDonationJpy: publicInterestCorporationDonation || 0,
        totalIncomeJpy: totalIncome || 0,
        incomeTaxBeforeCreditJpy: incomeTaxBeforeCredit || 0,
        certifiedNpoResidentTaxOrdinanceDesignated: certifiedNpoOrdinanceDesignated,
        publicInterestCorporationResidentTaxOrdinanceDesignated:
          publicInterestCorporationOrdinanceDesignated,
      });
    } catch {
      return null;
    }
  }, [
    politicalPartyDonation,
    certifiedNpoDonation,
    publicInterestCorporationDonation,
    totalIncome,
    incomeTaxBeforeCredit,
    certifiedNpoOrdinanceDesignated,
    publicInterestCorporationOrdinanceDesignated,
  ]);

  const comparisonDonationJpy =
    comparisonCategory === "POLITICAL_PARTY"
      ? politicalPartyDonation
      : comparisonCategory === "CERTIFIED_NPO"
        ? certifiedNpoDonation
        : publicInterestCorporationDonation;

  const comparison = useMemo(() => {
    try {
      return compareDonationTaxTreatment(
        comparisonCategory,
        comparisonDonationJpy || 0,
        totalIncome || 0,
        incomeTaxBeforeCredit || 0,
        marginalRate || 0,
      );
    } catch {
      return null;
    }
  }, [comparisonCategory, comparisonDonationJpy, totalIncome, incomeTaxBeforeCredit, marginalRate]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">入力</legend>
        <Field
          label="政党等に対する寄附金の額"
          helper="政党・政治資金団体に対する、政治資金規正法上適正な寄附金の合計額"
          value={politicalPartyDonation}
          onChange={setPoliticalPartyDonation}
        />
        <Field
          label="認定NPO法人等に対する寄附金の額"
          helper="認定NPO法人・特例認定NPO法人に対する寄附金の合計額"
          value={certifiedNpoDonation}
          onChange={setCertifiedNpoDonation}
        />
        <Field
          label="公益社団法人等に対する寄附金の額"
          helper="公益社団法人・公益財団法人等、一定の要件を満たす寄附金の合計額"
          value={publicInterestCorporationDonation}
          onChange={setPublicInterestCorporationDonation}
        />
        <Field
          label="総所得金額等"
          helper="寄附金額の40%上限の判定に使う"
          value={totalIncome}
          onChange={setTotalIncome}
        />
        <Field
          label="特別控除適用前の所得税額"
          helper="25%上限の判定用。/tax-estimateの試算結果を参考に入力"
          value={incomeTaxBeforeCredit}
          onChange={setIncomeTaxBeforeCredit}
        />
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">
          住民税の寄附金控除(基本控除)の対象(条例指定の有無)
        </legend>
        <p className="text-xs text-neutral-500 sm:col-span-2">
          政党等寄附金は住民税の条例指定寄附金の対象外のため常に住民税の控除額は0円になる。
          認定NPO法人等・公益社団法人等への寄附は、寄附先が住所地の都道府県・市区町村の条例で
          個別に指定されている場合のみ住民税の控除対象になる(自治体公式サイトで確認すること)。
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={certifiedNpoOrdinanceDesignated}
            onChange={(e) => setCertifiedNpoOrdinanceDesignated(e.target.checked)}
          />
          認定NPO法人等への寄附先が条例指定を受けている
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={publicInterestCorporationOrdinanceDesignated}
            onChange={(e) => setPublicInterestCorporationOrdinanceDesignated(e.target.checked)}
          />
          公益社団法人等への寄附先が条例指定を受けている
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">政党等寄附金特別控除額</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.politicalPartyCreditJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">
                認定NPO法人等・公益社団法人等寄附金特別控除額(合計)
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.npoAndPublicInterestCreditJpy)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                内訳: 認定NPO法人等 {yen(result.certifiedNpoCreditRawJpy)} / 公益社団法人等{" "}
                {yen(result.publicInterestCorporationCreditRawJpy)}(上限適用前)
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">特別控除額の合計(所得税分)</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalTaxCreditJpy)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                所得税額の25%相当額 {yen(result.taxAmountCapJpy)}(政党等/NPO等+公益法人等それぞれの上限)
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">住民税の寄附金控除(基本控除)額の合計</p>
            <p className="mt-1 text-2xl font-semibold">
              {yen(result.totalResidentTaxBasicDeductionJpy)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              内訳: 認定NPO法人等 {yen(result.certifiedNpoResidentTaxBasicDeductionJpy)} / 公益社団法人等{" "}
              {yen(result.publicInterestCorporationResidentTaxBasicDeductionJpy)}
              (いずれも条例指定を受けている場合のみ)
            </p>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveDonationTaxCreditRecord}>
              <input type="hidden" name="year" value={taxYear} />
              <input
                type="hidden"
                name="totalTaxCreditJpy"
                value={result.totalTaxCreditJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxBasicDeductionJpy"
                value={result.totalResidentTaxBasicDeductionJpy.toString()}
              />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{taxYear}年分の寄附金特別控除として登録する
              </button>
            </form>
            {registeredRecord !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み({registeredRecord.taxYear}年分): 所得税分 {yen(registeredRecord.totalTaxCreditJpy)}
                / 住民税分 {yen(registeredRecord.residentTaxBasicDeductionJpy)}
                (/tax-estimateの初期値・下書きCSVに反映)
              </p>
            )}
          </div>

          <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
            <legend className="px-1 text-sm font-medium">
              通常の寄附金控除(所得控除)との比較
            </legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">比較する寄附区分</span>
              <select
                value={comparisonCategory}
                onChange={(e) =>
                  setComparisonCategory(e.target.value as DonationTaxCreditCategory)
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {COMPARISON_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {DONATION_TAX_CREDIT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
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

          {comparison !== null && (
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">
                {DONATION_TAX_CREDIT_CATEGORY_LABELS[comparisonCategory]}の所得税軽減額比較
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="text-sm">
                  税額控除を選んだ場合: <span className="font-semibold">{yen(comparison.taxCreditJpy)}</span>
                </p>
                <p className="text-sm">
                  所得控除を選んだ場合:{" "}
                  <span className="font-semibold">
                    {yen(comparison.incomeDeductionIncomeTaxSavingsJpy)}
                  </span>
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold">
                {RECOMMENDATION_LABELS[comparison.recommended]}
                {comparison.recommended !== "EITHER" && `(差額 ${yen(comparison.advantageJpy)})`}
              </p>
            </div>
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
