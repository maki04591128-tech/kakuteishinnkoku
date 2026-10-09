// スタンドアロン版ビルド用の`@/lib/unrealizedGainPageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3継続11回目)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`UnrealizedGainPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `buildYearReport`・`listTaxYears`・`marketPriceRepository.findMany`を呼ぶ
// 実装に差し替える。これらは5-1-3bのビルドターゲット切り替え機構経由で参照する
// ため、このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない
// (スタンドアロンビルドでは自動的にクライアントDB(wa-sqlite/OPFS)側に解決
// される)。呼び出し元が`"use client"`コンポーネントであるため、この関数自体に
// `"use server"`を付けずただのブラウザ内関数呼び出しとする(自宅サーバー版と
// 違いRPCを経由しない)。
import { buildYearReport } from "@/lib/reporting";
import { listTaxYears } from "@/lib/taxYear";
import { marketPriceRepository } from "@/lib/repositories/defaultMarketPriceRepository";
import type {
  UnrealizedGainPageData,
  UnrealizedGainPageDataHolding,
} from "@/lib/unrealizedGainPageData.types";

export async function getUnrealizedGainPageData(
  yearParam: number | null,
): Promise<UnrealizedGainPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const [report, marketPrices] = await Promise.all([
    buildYearReport(year),
    marketPriceRepository.findMany(),
  ]);
  const marketPriceBySymbol = new Map(
    marketPrices.map((p) => [p.symbol.toUpperCase(), p.priceJpy.toString()]),
  );

  const holdings: UnrealizedGainPageDataHolding[] = [];
  if (report) {
    for (const s of report.crypto.bySymbol) {
      if (s.closingQuantity.isZero()) continue;
      holdings.push({
        assetType: "CRYPTO",
        symbol: s.symbol,
        quantity: s.closingQuantity.toString(),
        costBasisJpy: s.closingCostJpy.toString(),
        defaultCurrentPriceJpy:
          marketPriceBySymbol.get(s.symbol.toUpperCase()) ?? s.averageUnitCostJpy.toString(),
      });
    }
    for (const s of report.investment.bySymbol) {
      const registeredPriceJpy = marketPriceBySymbol.get(s.symbol.toUpperCase());
      if (!s.closingQuantity.isZero()) {
        const averageUnitCostJpy = s.closingCostJpy.dividedBy(s.closingQuantity);
        holdings.push({
          assetType: "INVESTMENT",
          symbol: s.symbol,
          quantity: s.closingQuantity.toString(),
          costBasisJpy: s.closingCostJpy.toString(),
          defaultCurrentPriceJpy: registeredPriceJpy ?? averageUnitCostJpy.toString(),
        });
      }
      if (!s.nisaClosingQuantity.isZero()) {
        const nisaAverageUnitCostJpy = s.nisaClosingCostJpy.dividedBy(s.nisaClosingQuantity);
        holdings.push({
          assetType: "INVESTMENT_NISA",
          symbol: s.symbol,
          quantity: s.nisaClosingQuantity.toString(),
          costBasisJpy: s.nisaClosingCostJpy.toString(),
          defaultCurrentPriceJpy: registeredPriceJpy ?? nisaAverageUnitCostJpy.toString(),
        });
      }
    }
  }

  return { year, availableYears, holdings };
}
