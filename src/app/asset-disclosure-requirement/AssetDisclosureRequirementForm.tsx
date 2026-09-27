"use client";

import { useId, useMemo, useState } from "react";
import {
  determineAssetDisclosureRequirement,
  type ResidencyStatusForDisclosure,
} from "@/lib/assetDisclosureRequirement";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const RESIDENCY_LABELS: Record<ResidencyStatusForDisclosure, string> = {
  RESIDENT: "居住者(非永住者以外)",
  NON_PERMANENT_RESIDENT: "非永住者",
  NON_RESIDENT: "非居住者",
};

export function AssetDisclosureRequirementForm() {
  const idPrefix = useId();
  const [residencyStatus, setResidencyStatus] =
    useState<ResidencyStatusForDisclosure>("RESIDENT");
  const [hasIncomeTaxReturnObligation, setHasIncomeTaxReturnObligation] = useState(true);
  const [aggregateIncome, setAggregateIncome] = useState("0");
  const [cryptoAssets, setCryptoAssets] = useState("0");
  const [overseasAssetsExcludingCrypto, setOverseasAssetsExcludingCrypto] = useState("0");
  const [totalAssets, setTotalAssets] = useState("0");
  const [section60SecuritiesEtc, setSection60SecuritiesEtc] = useState("0");

  const result = useMemo(() => {
    try {
      return determineAssetDisclosureRequirement({
        residencyStatus,
        hasIncomeTaxReturnObligationOrEligibleRefundReturn: hasIncomeTaxReturnObligation,
        aggregateIncomeExcludingRetirementJpy: aggregateIncome || 0,
        cryptoAssetsJpy: cryptoAssets || 0,
        overseasAssetsExcludingCryptoJpy: overseasAssetsExcludingCrypto || 0,
        totalAssetsJpy: totalAssets || 0,
        section60SecuritiesEtcJpy: section60SecuritiesEtc || 0,
      });
    } catch {
      return null;
    }
  }, [
    residencyStatus,
    hasIncomeTaxReturnObligation,
    aggregateIncome,
    cryptoAssets,
    overseasAssetsExcludingCrypto,
    totalAssets,
    section60SecuritiesEtc,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">居住形態・所得</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">その年の12月31日現在の居住形態</span>
          <select
            id={`${idPrefix}-residency`}
            value={residencyStatus}
            onChange={(e) =>
              setResidencyStatus(e.target.value as ResidencyStatusForDisclosure)
            }
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(Object.keys(RESIDENCY_LABELS) as ResidencyStatusForDisclosure[]).map((key) => (
              <option key={key} value={key}>
                {RESIDENCY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            id={`${idPrefix}-return-obligation`}
            type="checkbox"
            checked={hasIncomeTaxReturnObligation}
            onChange={(e) => setHasIncomeTaxReturnObligation(e.target.checked)}
          />
          <span className="text-neutral-500">
            所得税の確定申告書を提出する必要がある、又は一定の還付申告書を提出できる
            (財産債務調書の要件1の前提条件)
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-neutral-500">
            その年分の退職所得を除く各種所得金額の合計額
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={aggregateIncome}
            onChange={(e) => setAggregateIncome(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">
          その年の12月31日時点の財産の状況
        </legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            暗号資産(仮想通貨)の価額の合計額(保管先が国内・国外いずれの交換業者・
            ウォレットでも合算する)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={cryptoAssets}
            onChange={(e) => setCryptoAssets(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            暗号資産を除く国外財産(国外の不動産・預貯金・有価証券等)の価額の合計額
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={overseasAssetsExcludingCrypto}
            onChange={(e) => setOverseasAssetsExcludingCrypto(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            財産(国内・国外、暗号資産を含む)の価額の合計額
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={totalAssets}
            onChange={(e) => setTotalAssets(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            うち所得税法60条の2の有価証券等・未決済信用取引等・未決済デリバティブ取引に
            係る権利の価額の合計額(暗号資産を含まない)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={section60SecuritiesEtc}
            onChange={(e) => setSection60SecuritiesEtc(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(金額は0以上)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              className={`rounded-lg border p-4 ${
                result.overseasAssetStatement.required
                  ? "border-amber-500"
                  : "border-neutral-900 dark:border-white"
              }`}
            >
              <p className="text-sm text-neutral-500">国外財産調書</p>
              <p className="mt-1 text-2xl font-semibold">
                {result.overseasAssetStatement.required ? "提出義務あり" : "提出義務なし"}
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                判定に用いた国外財産(暗号資産を除く)の合計額:{" "}
                {yen(result.overseasAssetStatement.overseasAssetsTotalJpy)}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                {result.overseasAssetStatement.reason}
              </p>
            </div>
            <div
              className={`rounded-lg border p-4 ${
                result.assetLiabilityStatement.required
                  ? "border-amber-500"
                  : "border-neutral-900 dark:border-white"
              }`}
            >
              <p className="text-sm text-neutral-500">財産債務調書</p>
              <p className="mt-1 text-2xl font-semibold">
                {result.assetLiabilityStatement.required ? "提出義務あり" : "提出義務なし"}
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                要件1: {result.assetLiabilityStatement.satisfiesRequirement1 ? "該当" : "非該当"}
                {" / "}
                要件2: {result.assetLiabilityStatement.satisfiesRequirement2 ? "該当" : "非該当"}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                {result.assetLiabilityStatement.reason}
              </p>
            </div>
          </div>

          <p className="text-sm text-neutral-500">{result.deadlineNote}</p>

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
