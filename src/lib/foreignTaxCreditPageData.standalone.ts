// スタンドアロン版ビルド用の`@/lib/foreignTaxCreditPageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3継続10回目)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`ForeignTaxCreditPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`・`getOrCreateTaxYear`・
// `foreignTaxCreditCarryforwardRepository.findByTaxYearId`・
// `foreignTaxCreditSpareLimitCarryforwardRepository.findByTaxYearId`・
// `buildYearReport`・`getForeignTaxCreditRecord`を呼ぶ実装に差し替える。
// これらは5-1-3bのビルドターゲット切り替え機構経由で参照するため、このファイル
// 自体はPrisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。呼び出し元が
// `"use client"`コンポーネントであるため、この関数自体に`"use server"`を付けず
// ただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
import { getForeignTaxCreditRecord } from "@/lib/investment/foreignTaxCredit";
import { buildYearReport } from "@/lib/reporting";
import { foreignTaxCreditCarryforwardRepository } from "@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository";
import { foreignTaxCreditSpareLimitCarryforwardRepository } from "@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository";
import { getOrCreateTaxYear, listTaxYears } from "@/lib/taxYear";
import type { ForeignTaxCreditPageData } from "@/lib/foreignTaxCreditPageData.types";

export async function getForeignTaxCreditPageData(
  yearParam: number | null,
): Promise<ForeignTaxCreditPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const taxYear = await getOrCreateTaxYear(year);
  const [carryforwards, spareLimitCarryforwards, report, registeredRecord] = await Promise.all([
    foreignTaxCreditCarryforwardRepository.findByTaxYearId(taxYear.id),
    foreignTaxCreditSpareLimitCarryforwardRepository.findByTaxYearId(taxYear.id),
    buildYearReport(year),
    getForeignTaxCreditRecord(year),
  ]);

  return {
    year,
    availableYears,
    carryforwardEntries: carryforwards.map((c) => ({
      originYear: c.originYear,
      remainingAmountJpy: c.remainingAmountJpy.toString(),
    })),
    spareLimitCarryforwardEntries: spareLimitCarryforwards.map((c) => ({
      originYear: c.originYear,
      remainingAmountJpy: c.remainingAmountJpy.toString(),
    })),
    autoForeignSourceIncomeJpy: report?.investment.totalForeignSourceIncomeJpy.toString() ?? "0",
    autoForeignIncomeTaxPaidJpy:
      report?.investment.totalForeignTaxWithheldJpy.toString() ?? "0",
    registeredTotalCreditJpy: registeredRecord
      ? {
          totalCreditJpy: registeredRecord.totalCreditJpy.toNumber(),
          nationalTaxCreditJpy: registeredRecord.nationalTaxCreditJpy.toNumber(),
          residentTaxCreditJpy: registeredRecord.residentTaxCreditJpy.toNumber(),
        }
      : null,
  };
}
