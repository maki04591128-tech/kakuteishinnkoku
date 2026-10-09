"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続11回目。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`unrealizedGainPageData.standalone.ts`に差し替えられる。
//
// `/unrealized-gain`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/unrealized-gain/page.tsx`・`UnrealizedGainPageContent.tsx`参照)。
// このファイルはそのClient Componentから`useEffect`(+`startTransition`)で
// 呼び出すServer Function(`"use server"`)として、既存の`buildYearReport`・
// `listTaxYears`・`marketPriceRepository.findMany`(いずれもリポジトリ抽象経由で
// Prisma/クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
// このページは`saveXxx`/`deleteXxx`等のServer Actionを一切持たない単体
// シミュレーター画面(入力内容はその場で試算するだけでDBへの書き込みは発生しない)
// のため、`Actions`用エイリアスの追加は不要。
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
