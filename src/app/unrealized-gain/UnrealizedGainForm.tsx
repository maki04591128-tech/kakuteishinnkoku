"use client";

import { useMemo, useState } from "react";
import {
  summarizeUnrealizedGains,
  type UnrealizedAssetType,
} from "@/lib/unrealizedGain";

const ASSET_TYPE_LABEL: Record<UnrealizedAssetType, string> = {
  CRYPTO: "暗号資産(雑所得)",
  INVESTMENT: "株式等(課税口座)",
  INVESTMENT_NISA: "株式等(NISA口座)",
};

const LOSS_HARVEST_NOTE: Record<UnrealizedAssetType, string> = {
  CRYPTO: "含み損を実現すると当年の暗号資産の雑所得を圧縮できる(繰越不可)",
  INVESTMENT: "含み損を実現すると当年の株式等の譲渡益・配当と損益通算でき、控除しきれない分は3年間繰り越せる",
  INVESTMENT_NISA: "NISA口座は非課税のため、含み損を実現しても他の所得と損益通算できない",
};

export interface UnrealizedGainFormHolding {
  assetType: UnrealizedAssetType;
  symbol: string;
  quantity: string;
  costBasisJpy: string;
  defaultCurrentPriceJpy: string;
}

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function num(value: { toString(): string }): string {
  return Number(value.toString()).toLocaleString("ja-JP", { maximumFractionDigits: 8 });
}

export function UnrealizedGainForm({ holdings }: { holdings: UnrealizedGainFormHolding[] }) {
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      holdings.map((h) => [rowKey(h), h.defaultCurrentPriceJpy]),
    ),
  );

  const summary = useMemo(() => {
    try {
      return summarizeUnrealizedGains(
        holdings.map((h) => ({
          assetType: h.assetType,
          symbol: h.symbol,
          quantity: h.quantity,
          costBasisJpy: h.costBasisJpy,
          currentPriceJpy: prices[rowKey(h)] === "" ? 0 : prices[rowKey(h)],
        })),
      );
    } catch {
      return null;
    }
  }, [holdings, prices]);

  if (holdings.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
        この年分に期末保有数量が残っている銘柄がない。取引を登録すると、保有中の銘柄がここに表示される。
      </p>
    );
  }

  if (summary === null) {
    return <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-3">資産区分</th>
              <th className="py-2 pr-3">銘柄</th>
              <th className="py-2 pr-3 text-right">保有数量</th>
              <th className="py-2 pr-3 text-right">平均取得単価</th>
              <th className="py-2 pr-3 text-right">現在価格(1単位)</th>
              <th className="py-2 pr-3 text-right">評価額</th>
              <th className="py-2 text-right">含み損益</th>
            </tr>
          </thead>
          <tbody>
            {summary.holdings.map((h, i) => {
              const holding = holdings[i];
              const key = rowKey(holding);
              return (
                <tr
                  key={key}
                  className="border-b border-neutral-100 dark:border-neutral-900"
                >
                  <td className="py-2 pr-3 text-neutral-500">{ASSET_TYPE_LABEL[h.assetType]}</td>
                  <td className="py-2 pr-3 font-medium">{h.symbol}</td>
                  <td className="py-2 pr-3 text-right">{num(h.quantity)}</td>
                  <td className="py-2 pr-3 text-right text-neutral-500">
                    {yen(h.averageUnitCostJpy)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={prices[key] ?? ""}
                      onChange={(e) =>
                        setPrices((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-32 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </td>
                  <td className="py-2 pr-3 text-right">{yen(h.marketValueJpy)}</td>
                  <td
                    className={`py-2 text-right font-medium ${
                      h.unrealizedGainJpy.isNegative()
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {yen(h.unrealizedGainJpy)}
                    {h.isLossHarvestCandidate && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-normal text-red-700 dark:bg-red-950 dark:text-red-300">
                        損出し候補
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <SummaryCard title="評価額合計" value={yen(summary.totalMarketValueJpy)} />
        <SummaryCard
          title="含み損益合計(全体)"
          value={yen(summary.totalUnrealizedGainJpy)}
          negative={summary.totalUnrealizedGainJpy.isNegative()}
        />
        <SummaryCard
          title="含み損益(暗号資産)"
          value={yen(summary.totalByAssetType.CRYPTO)}
          negative={summary.totalByAssetType.CRYPTO.isNegative()}
        />
        <SummaryCard
          title="含み損益(株式等・課税口座)"
          value={yen(summary.totalByAssetType.INVESTMENT)}
          negative={summary.totalByAssetType.INVESTMENT.isNegative()}
        />
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
        {(Object.keys(LOSS_HARVEST_NOTE) as UnrealizedAssetType[]).map((assetType) => (
          <li key={assetType}>
            {ASSET_TYPE_LABEL[assetType]}: {LOSS_HARVEST_NOTE[assetType]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function rowKey(h: { assetType: UnrealizedAssetType; symbol: string }): string {
  return `${h.assetType}:${h.symbol}`;
}

function SummaryCard({
  title,
  value,
  negative,
}: {
  title: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className={`mt-1 text-xl font-semibold ${negative ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
