"use client";

import { useId, useMemo, useState } from "react";
import {
  CRYPTO_BUSINESS_INCOME_REVENUE_THRESHOLD_JPY,
  determineCryptoIncomeCategory,
  type CryptoIncomeCategory,
} from "@/lib/crypto/incomeClassification";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const CATEGORY_BADGE_CLASS: Record<CryptoIncomeCategory, string> = {
  BUSINESS_INCOME: "border-neutral-900 dark:border-white",
  MISCELLANEOUS_BUSINESS: "border-neutral-900 dark:border-white",
  MISCELLANEOUS_OTHER: "border-neutral-900 dark:border-white",
  NEEDS_INDIVIDUAL_JUDGMENT: "border-amber-500",
};

export function CryptoIncomeClassificationForm({
  defaultTotalRevenueJpy = 0,
}: {
  defaultTotalRevenueJpy?: number;
}) {
  const idPrefix = useId();
  const [totalRevenue, setTotalRevenue] = useState(String(defaultTotalRevenueJpy));
  const [isIncidentalToExistingBusiness, setIsIncidentalToExistingBusiness] = useState(false);
  const [hasBookkeeping, setHasBookkeeping] = useState(false);
  const [profitMotiveRecognized, setProfitMotiveRecognized] = useState(true);

  const result = useMemo(() => {
    try {
      return determineCryptoIncomeCategory({
        totalRevenueJpy: totalRevenue || 0,
        isIncidentalToExistingBusiness,
        hasBookkeeping,
        profitMotiveRecognized,
      });
    } catch {
      return null;
    }
  }, [totalRevenue, isIncidentalToExistingBusiness, hasBookkeeping, profitMotiveRecognized]);

  const needsBookkeepingQuestion =
    !isIncidentalToExistingBusiness &&
    Number(totalRevenue || 0) > CRYPTO_BUSINESS_INCOME_REVENUE_THRESHOLD_JPY.toNumber();
  const needsProfitMotiveQuestion = needsBookkeepingQuestion && hasBookkeeping;

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">暗号資産取引の状況</legend>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-neutral-500">
            その年の暗号資産取引に係る収入金額の合計(必要経費控除前。売却対価・商品購入時の
            使用に伴う対価・暗号資産同士の交換における譲渡対価・マイニング等の受取時の時価等の
            合計)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={totalRevenue}
            onChange={(e) => setTotalRevenue(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            id={`${idPrefix}-incidental`}
            type="checkbox"
            checked={isIncidentalToExistingBusiness}
            onChange={(e) => setIsIncidentalToExistingBusiness(e.target.checked)}
          />
          <span className="text-neutral-500">
            既に営んでいる事業所得等を生ずべき業務に付随した暗号資産取引である(例: 事業用資産として
            保有する暗号資産を棚卸資産等の購入の決済手段として使用した場合)
          </span>
        </label>
        <label
          className={`flex items-center gap-2 text-sm ${
            needsBookkeepingQuestion ? "" : "opacity-50"
          }`}
        >
          <input
            id={`${idPrefix}-bookkeeping`}
            type="checkbox"
            checked={hasBookkeeping}
            onChange={(e) => setHasBookkeeping(e.target.checked)}
            disabled={!needsBookkeepingQuestion}
          />
          <span className="text-neutral-500">
            暗号資産取引に係る帳簿書類(取引の年月日・数量・単価・相手方等を記録した帳簿等)の
            保存がある(収入金額が300万円を超える場合のみ判定に使用)
          </span>
        </label>
        <label
          className={`flex items-center gap-2 text-sm ${
            needsProfitMotiveQuestion ? "" : "opacity-50"
          }`}
        >
          <input
            id={`${idPrefix}-profit-motive`}
            type="checkbox"
            checked={profitMotiveRecognized}
            onChange={(e) => setProfitMotiveRecognized(e.target.checked)}
            disabled={!needsProfitMotiveQuestion}
          />
          <span className="text-neutral-500">
            暗号資産取引に営利性が認められる(収入金額300万円超・帳簿書類の保存ありの場合のみ判定に使用。
            チェックを外すと事業所得該当性は個別判断として扱う)
          </span>
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(収入金額は0以上)。</p>
      ) : (
        <>
          <div
            className={`rounded-lg border p-4 ${CATEGORY_BADGE_CLASS[result.category]}`}
          >
            <p className="text-sm text-neutral-500">所得区分の判定結果</p>
            <p className="mt-1 text-2xl font-semibold">{result.categoryLabel}</p>
            <p className="mt-2 text-sm text-neutral-500">{result.reason}</p>
            <p className="mt-2 text-xs text-neutral-400">
              判定に用いた収入金額: {yen(result.totalRevenueJpy)}
            </p>
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
