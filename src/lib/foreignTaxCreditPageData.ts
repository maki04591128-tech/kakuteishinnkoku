"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続10回目。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`foreignTaxCreditPageData.standalone.ts`に差し替えられる。
//
// `/foreign-tax-credit`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/foreign-tax-credit/page.tsx`・`ForeignTaxCreditPageContent.tsx`参照)。
// このファイルはそのClient Componentから`useEffect`(+`startTransition`)で呼び出す
// Server Function(`"use server"`)として、既存の`listTaxYears`・`getOrCreateTaxYear`・
// `foreignTaxCreditCarryforwardRepository.findByTaxYearId`・
// `foreignTaxCreditSpareLimitCarryforwardRepository.findByTaxYearId`・
// `buildYearReport`・`getForeignTaxCreditRecord`(いずれもリポジトリ抽象経由で
// Prisma/クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
// `excessCarried`/`spareLimitCarried`/`foreignTaxCreditSaved`クエリ値はDBに依存
// しない純粋なURL表示フラグのため、このページデータには含めず呼び出し側
// (`ForeignTaxCreditPageContent.tsx`)で直接`useSearchParams()`から読み取る。
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
