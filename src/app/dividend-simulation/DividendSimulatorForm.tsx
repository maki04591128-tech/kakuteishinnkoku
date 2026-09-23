"use client";

import { useMemo, useState } from "react";
import {
  simulateDividendTaxation,
  simulateNonListedDividendTaxation,
  type DividendTaxMethod,
  type DividendTaxMethodResult,
  type NonListedDividendTaxMethod,
  type NonListedDividendTaxMethodResult,
} from "@/lib/investment/dividendTaxSimulation";

const METHOD_LABEL: Record<DividendTaxMethod, string> = {
  COMPREHENSIVE: "総合課税",
  SEPARATE: "申告分離課税",
  NO_FILING: "申告不要",
};

const NON_LISTED_METHOD_LABEL: Record<NonListedDividendTaxMethod, string> = {
  REPORT_ALL: "総合課税(全額申告)",
  SMALL_DIVIDEND_NO_FILING: "少額配当分は申告不要",
};

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function DividendSimulatorForm({
  defaultDividendJpy,
  defaultDividendHalfCreditJpy,
  defaultDividendNoCreditJpy,
  defaultAvailableListedStockLossJpy,
  defaultNonListedDividendJpy,
}: {
  defaultDividendJpy: number;
  defaultDividendHalfCreditJpy: number;
  defaultDividendNoCreditJpy: number;
  defaultAvailableListedStockLossJpy: number;
  defaultNonListedDividendJpy: number;
}) {
  const [dividendJpy, setDividendJpy] = useState(String(defaultDividendJpy));
  const [halfCreditDividendJpy, setHalfCreditDividendJpy] = useState(
    String(defaultDividendHalfCreditJpy),
  );
  const [noCreditDividendJpy, setNoCreditDividendJpy] = useState(
    String(defaultDividendNoCreditJpy),
  );
  const [otherIncomeJpy, setOtherIncomeJpy] = useState("5000000");
  const [lossJpy, setLossJpy] = useState(String(defaultAvailableListedStockLossJpy));

  const [nonListedDividendJpy, setNonListedDividendJpy] = useState(
    String(defaultNonListedDividendJpy),
  );
  const [smallDividendJpy, setSmallDividendJpy] = useState("0");

  const result = useMemo(() => {
    try {
      return simulateDividendTaxation({
        dividendIncomeJpy: dividendJpy === "" ? 0 : dividendJpy,
        dividendCreditBreakdown: {
          halfCreditJpy: halfCreditDividendJpy === "" ? 0 : halfCreditDividendJpy,
          noCreditJpy: noCreditDividendJpy === "" ? 0 : noCreditDividendJpy,
        },
        otherTaxableIncomeJpy: otherIncomeJpy === "" ? 0 : otherIncomeJpy,
        availableListedStockLossJpy: lossJpy === "" ? 0 : lossJpy,
      });
    } catch {
      return null;
    }
  }, [dividendJpy, halfCreditDividendJpy, noCreditDividendJpy, otherIncomeJpy, lossJpy]);

  const nonListedResult = useMemo(() => {
    try {
      return simulateNonListedDividendTaxation({
        nonListedDividendIncomeJpy: nonListedDividendJpy === "" ? 0 : nonListedDividendJpy,
        smallDividendJpy: smallDividendJpy === "" ? 0 : smallDividendJpy,
        otherTaxableIncomeJpy: otherIncomeJpy === "" ? 0 : otherIncomeJpy,
      });
    } catch {
      return null;
    }
  }, [nonListedDividendJpy, smallDividendJpy, otherIncomeJpy]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label="配当所得金額(源泉徴収前・年間合計)"
          value={dividendJpy}
          onChange={setDividendJpy}
        />
        <Field
          label="配当以外の課税所得金額(給与所得等)"
          value={otherIncomeJpy}
          onChange={setOtherIncomeJpy}
        />
        <Field
          label="損益通算できる上場株式等の譲渡損失(当年+繰越)"
          value={lossJpy}
          onChange={setLossJpy}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="うち株式投資信託等の分配金(配当控除が半分税率)"
          value={halfCreditDividendJpy}
          onChange={setHalfCreditDividendJpy}
        />
        <Field
          label="うち公社債投資信託・J-REIT等の分配金(配当控除の対象外)"
          value={noCreditDividendJpy}
          onChange={setNoCreditDividendJpy}
        />
      </div>
      <p className="text-xs text-neutral-500">
        上記2つの内訳欄は「配当所得金額」の内数として入力する(残りは上場株式等の普通配当・ETF等として
        通常税率で計算する)。銘柄種別を登録済みの取引から自動集計した値を初期値として表示している。
      </p>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MethodCard
              result={result.comprehensive}
              recommended={result.recommendedMethod === "COMPREHENSIVE"}
              extra={
                result.comprehensive.dividendCreditJpy
                  ? `配当控除: ${yen(result.comprehensive.dividendCreditJpy)}`
                  : undefined
              }
            />
            <MethodCard
              result={result.separate}
              recommended={result.recommendedMethod === "SEPARATE"}
              extra={
                result.separate.lossOffsetUsedJpy
                  ? `損益通算に使用: ${yen(result.separate.lossOffsetUsedJpy)}`
                  : undefined
              }
            />
            <MethodCard
              result={result.noFiling}
              recommended={result.recommendedMethod === "NO_FILING"}
            />
          </div>

          {result.remainingListedStockLossJpy.greaterThan(0) && (
            <p className="text-sm text-neutral-500">
              申告分離課税を選んだ場合の繰越譲渡損失の残額: {yen(result.remainingListedStockLossJpy)}
            </p>
          )}

          <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
            {result.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      )}

      <hr className="border-neutral-200 dark:border-neutral-800" />

      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          一般株式等(非上場株式)の配当所得
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          上場株式等と異なり申告分離課税は選択できない。少額配当(1回の配当金額が10万円×配当計算期間の月数÷12以下)に
          該当する部分のみ、所得税に限り確定申告不要制度を選択できる(住民税は常に総合課税での申告が必要)。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="一般株式等(非上場株式)の配当所得金額(源泉徴収前・年間合計)"
          value={nonListedDividendJpy}
          onChange={setNonListedDividendJpy}
        />
        <Field
          label="うち少額配当に該当する額(支払いごとに自身で判定)"
          value={smallDividendJpy}
          onChange={setSmallDividendJpy}
        />
      </div>

      {nonListedResult === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div
            className={`grid grid-cols-1 gap-4 ${
              nonListedResult.smallDividendNoFiling ? "sm:grid-cols-2" : "sm:grid-cols-1"
            }`}
          >
            <NonListedMethodCard
              result={nonListedResult.reportAll}
              recommended={nonListedResult.recommendedMethod === "REPORT_ALL"}
            />
            {nonListedResult.smallDividendNoFiling && (
              <NonListedMethodCard
                result={nonListedResult.smallDividendNoFiling}
                recommended={nonListedResult.recommendedMethod === "SMALL_DIVIDEND_NO_FILING"}
              />
            )}
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
            {nonListedResult.notes.map((note, i) => (
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

function MethodCard({
  result,
  recommended,
  extra,
}: {
  result: DividendTaxMethodResult;
  recommended: boolean;
  extra?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        recommended
          ? "border-neutral-900 dark:border-white"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <p className="flex items-center justify-between text-sm text-neutral-500">
        <span>{METHOD_LABEL[result.method]}</span>
        {recommended && (
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-neutral-900">
            有利
          </span>
        )}
      </p>
      <p className="mt-1 text-2xl font-semibold">{yen(result.totalTaxJpy)}</p>
      <p className="mt-1 text-xs text-neutral-400">
        国税 {yen(result.nationalTaxJpy)} + 住民税 {yen(result.residentTaxJpy)}
      </p>
      {extra && <p className="mt-1 text-xs text-neutral-400">{extra}</p>}
    </div>
  );
}

function NonListedMethodCard({
  result,
  recommended,
}: {
  result: NonListedDividendTaxMethodResult;
  recommended: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        recommended
          ? "border-neutral-900 dark:border-white"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <p className="flex items-center justify-between text-sm text-neutral-500">
        <span>{NON_LISTED_METHOD_LABEL[result.method]}</span>
        {recommended && (
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-neutral-900">
            有利
          </span>
        )}
      </p>
      <p className="mt-1 text-2xl font-semibold">{yen(result.totalTaxJpy)}</p>
      <p className="mt-1 text-xs text-neutral-400">
        国税 {yen(result.nationalTaxJpy)} + 住民税 {yen(result.residentTaxJpy)}
        {result.nationalWithholdingFinalJpy
          ? ` + 申告不要分の源泉徴収 ${yen(result.nationalWithholdingFinalJpy)}`
          : ""}
      </p>
      <p className="mt-1 text-xs text-neutral-400">配当控除: {yen(result.dividendCreditJpy)}</p>
    </div>
  );
}
