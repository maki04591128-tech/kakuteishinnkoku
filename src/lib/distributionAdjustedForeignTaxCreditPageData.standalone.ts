// スタンドアロン版ビルド用の
// `@/lib/distributionAdjustedForeignTaxCreditPageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3継続)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元
// (`DistributionAdjustedForeignTaxCreditPageContent.tsx`、`"use client"`
// コンポーネント)から見た関数シグネチャを変えずに、同じ`listTaxYears`・
// `buildYearReport`・`getDistributionAdjustedForeignTaxCreditRecord`を呼ぶ
// 実装に差し替える。これらは5-1-3bのビルドターゲット切り替え機構経由で
// 参照するため、このファイル自体はPrisma/クライアントDBどちらの実装かを
// 意識しない(スタンドアロンビルドでは自動的にクライアントDB(wa-sqlite/OPFS)
// 側に解決される)。呼び出し元が`"use client"`コンポーネントであるため、
// この関数自体に`"use server"`を付けずただのブラウザ内関数呼び出しとする
// (自宅サーバー版と違いRPCを経由しない)。
import { getDistributionAdjustedForeignTaxCreditRecord } from "@/lib/investment/distributionAdjustedForeignTaxCredit";
import { buildYearReport } from "@/lib/reporting";
import { listTaxYears } from "@/lib/taxYear";
import type { DistributionAdjustedForeignTaxCreditPageData } from "@/lib/distributionAdjustedForeignTaxCreditPageData.types";

export async function getDistributionAdjustedForeignTaxCreditPageData(
  yearParam: number | null,
): Promise<DistributionAdjustedForeignTaxCreditPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const [report, registeredRecord] = await Promise.all([
    buildYearReport(year),
    getDistributionAdjustedForeignTaxCreditRecord(year),
  ]);

  const autoDistributionAdjustedForeignTaxJpy =
    report?.investment.totalDistributionAdjustedForeignTaxJpy.toString() ?? "0";

  return {
    year,
    availableYears,
    autoDistributionAdjustedForeignTaxJpy,
    registeredCreditJpy: registeredRecord ? registeredRecord.creditJpy.toNumber() : null,
  };
}
