"use client";

import { useMemo, useState } from "react";
import { saveMortgageDeductionRecord } from "@/app/actions";
import {
  HOUSING_CATEGORY_LABEL,
  calculateMortgageDeduction,
  type HousingCategory,
} from "@/lib/mortgageDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function MortgageDeductionForm({
  defaultTaxYear,
  registeredRecord,
}: {
  defaultTaxYear: number;
  /** `/tax-estimate`と連携するため既に登録済みの住宅ローン控除額(未登録ならnull) */
  registeredRecord: {
    taxYear: number;
    nationalTaxCreditJpy: number;
    residentTaxCreditJpy: number;
  } | null;
}) {
  const [taxYear, setTaxYear] = useState(String(defaultTaxYear));
  const [moveInYear, setMoveInYear] = useState(String(defaultTaxYear));
  const [housingCategory, setHousingCategory] = useState<HousingCategory>("ENERGY_SAVING");
  const [isExistingHome, setIsExistingHome] = useState(false);
  const [isChildRearingHousehold, setIsChildRearingHousehold] = useState(false);
  const [isSmallFloorArea, setIsSmallFloorArea] = useState(false);
  const [isJointDebt, setIsJointDebt] = useState(false);
  const [jointDebtShareRatioPercent, setJointDebtShareRatioPercent] = useState("50");
  const [yearEndLoanBalanceJpy, setYearEndLoanBalanceJpy] = useState("30000000");
  const [totalIncomeJpy, setTotalIncomeJpy] = useState("6000000");
  const [residentTaxTaxableIncomeJpy, setResidentTaxTaxableIncomeJpy] = useState("");
  const [nationalIncomeTaxBeforeThisCreditJpy, setNationalIncomeTaxBeforeThisCreditJpy] =
    useState("");

  const result = useMemo(() => {
    try {
      return calculateMortgageDeduction({
        taxYear: Number(taxYear),
        moveInYear: Number(moveInYear),
        housingCategory,
        isExistingHome,
        isChildRearingHousehold,
        isSmallFloorArea,
        yearEndLoanBalanceJpy: yearEndLoanBalanceJpy === "" ? 0 : yearEndLoanBalanceJpy,
        jointDebtShareRatioPercent:
          isJointDebt && jointDebtShareRatioPercent !== "" ? jointDebtShareRatioPercent : undefined,
        totalIncomeJpy: totalIncomeJpy === "" ? 0 : totalIncomeJpy,
        residentTaxTaxableIncomeJpy:
          residentTaxTaxableIncomeJpy === "" ? undefined : residentTaxTaxableIncomeJpy,
        nationalIncomeTaxBeforeThisCreditJpy:
          nationalIncomeTaxBeforeThisCreditJpy === ""
            ? undefined
            : nationalIncomeTaxBeforeThisCreditJpy,
      });
    } catch {
      return null;
    }
  }, [
    taxYear,
    moveInYear,
    housingCategory,
    isExistingHome,
    isChildRearingHousehold,
    isSmallFloorArea,
    isJointDebt,
    jointDebtShareRatioPercent,
    yearEndLoanBalanceJpy,
    totalIncomeJpy,
    residentTaxTaxableIncomeJpy,
    nationalIncomeTaxBeforeThisCreditJpy,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="試算対象年分" value={taxYear} onChange={setTaxYear} />
        <Field label="居住を開始した年(令和4年=2022年〜令和7年=2025年)" value={moveInYear} onChange={setMoveInYear} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">住宅の区分</span>
          <select
            value={housingCategory}
            onChange={(e) => setHousingCategory(e.target.value as HousingCategory)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(Object.keys(HOUSING_CATEGORY_LABEL) as HousingCategory[]).map((c) => (
              <option key={c} value={c}>
                {HOUSING_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isExistingHome}
            onChange={(e) => setIsExistingHome(e.target.checked)}
          />
          既存住宅(中古)の取得
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isChildRearingHousehold}
            onChange={(e) => setIsChildRearingHousehold(e.target.checked)}
          />
          子育て世帯等(19歳未満の扶養親族あり、または夫婦のいずれかが40歳未満)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSmallFloorArea}
            onChange={(e) => setIsSmallFloorArea(e.target.checked)}
          />
          床面積40㎡以上50㎡未満の特例(新築等のみ・合計所得金額1,000万円以下)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isJointDebt}
            onChange={(e) => setIsJointDebt(e.target.checked)}
          />
          連帯債務(共有名義)の持分按分を行う
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={
            isJointDebt
              ? "その年の年末借入金残高(連帯債務者全員分の合計額)"
              : "その年の年末借入金残高(本人負担分)"
          }
          value={yearEndLoanBalanceJpy}
          onChange={setYearEndLoanBalanceJpy}
        />
        {isJointDebt && (
          <Field
            label="本人の債務負担割合(%。連帯債務者間の合意による割合)"
            value={jointDebtShareRatioPercent}
            onChange={setJointDebtShareRatioPercent}
          />
        )}
        <Field
          label={
            isSmallFloorArea && !isExistingHome
              ? "その年の合計所得金額(床面積特例のため1,000万円超は適用不可)"
              : "その年の合計所得金額(2,000万円超は適用不可)"
          }
          value={totalIncomeJpy}
          onChange={setTotalIncomeJpy}
        />
        <Field
          label="住民税の課税総所得金額等(任意・控除限度額の目安算出用)"
          value={residentTaxTaxableIncomeJpy}
          onChange={setResidentTaxTaxableIncomeJpy}
        />
        <Field
          label="所得税額・住宅ローン控除適用前(任意・住民税への繰越額算出用)"
          value={nationalIncomeTaxBeforeThisCreditJpy}
          onChange={setNationalIncomeTaxBeforeThisCreditJpy}
        />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(居住年は2022〜2025年、金額は0以上)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard title="借入限度額" value={yen(result.borrowingLimitJpy)} />
            <SummaryCard
              title="控除期間"
              value={`${result.controlPeriodYears}年間(${result.controlPeriodEndYear}年分まで)`}
            />
            {isJointDebt ? (
              <SummaryCard
                title="按分後の本人の年末借入金残高"
                value={yen(result.ownYearEndLoanBalanceJpy)}
              />
            ) : (
              <SummaryCard
                title="控除対象借入金残高"
                value={yen(result.deductibleBalanceJpy)}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              title={`${taxYear}年分の所得税の控除額`}
              value={result.eligible ? yen(result.nationalTaxCreditJpy) : "対象外"}
              highlight
            />
            {result.residentTaxCreditLimitJpy !== undefined && (
              <SummaryCard
                title="住民税の控除限度額(目安)"
                value={yen(result.residentTaxCreditLimitJpy)}
              />
            )}
            {result.residentTaxCreditJpy !== undefined && (
              <SummaryCard
                title="住民税から控除される額"
                value={yen(result.residentTaxCreditJpy)}
              />
            )}
          </div>

          {!result.eligible && result.ineligibleReason && (
            <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {result.ineligibleReason}
            </p>
          )}

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <form action={saveMortgageDeductionRecord}>
              <input type="hidden" name="year" value={taxYear} />
              <input
                type="hidden"
                name="nationalTaxCreditJpy"
                value={result.nationalTaxCreditJpy.toString()}
              />
              <input
                type="hidden"
                name="residentTaxCreditJpy"
                value={result.residentTaxCreditJpy?.toString() ?? "0"}
              />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                この試算結果を{taxYear}年分の住宅ローン控除として登録する
              </button>
            </form>
            {result.residentTaxCreditJpy === undefined && (
              <p className="mt-2 text-xs text-neutral-500">
                住民税から控除される額が未算出(所得税額・住宅ローン控除適用前が未入力)のため、
                登録すると住民税分は0円として保存される。
              </p>
            )}
            {registeredRecord !== null && (
              <p className="mt-2 text-xs text-neutral-500">
                登録済み({registeredRecord.taxYear}年分): 所得税{" "}
                {yen(registeredRecord.nationalTaxCreditJpy)} / 住民税{" "}
                {yen(registeredRecord.residentTaxCreditJpy)}(/tax-estimateの初期値に反映)
              </p>
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

function SummaryCard({
  title,
  value,
  highlight,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-neutral-900 dark:border-white"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
