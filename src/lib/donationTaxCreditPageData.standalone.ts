// スタンドアロン版ビルド用の`@/lib/donationTaxCreditPageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3。7-2の
// `basicDeductionPageData.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`DonationTaxCreditPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`・`getDonationTaxCreditRecord`を呼ぶ実装に差し替える。これらは
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`等)経由で
// 参照するため、このファイル自体はPrisma/クライアントDBどちらの実装かを
// 意識しない(スタンドアロンビルドでは自動的にクライアントDB(wa-sqlite/OPFS)側に
// 解決される)。呼び出し元が`"use client"`コンポーネントであるため、この関数自体に
// `"use server"`を付けずただのブラウザ内関数呼び出しとする(自宅サーバー版と違い
// RPCを経由しない)。
import { listTaxYears } from "@/lib/taxYear";
import { getDonationTaxCreditRecord } from "@/lib/donationTaxCredit";
import type { DonationTaxCreditPageData } from "@/lib/donationTaxCreditPageData.types";

export async function getDonationTaxCreditPageData(
  yearParam: number | null,
): Promise<DonationTaxCreditPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const donationTaxCreditRecord = await getDonationTaxCreditRecord(year);
  const registeredRecord = donationTaxCreditRecord
    ? {
        taxYear: donationTaxCreditRecord.taxYear,
        totalTaxCreditJpy: donationTaxCreditRecord.totalTaxCreditJpy.toNumber(),
        residentTaxBasicDeductionJpy:
          donationTaxCreditRecord.residentTaxBasicDeductionJpy.toNumber(),
      }
    : null;

  return { year, availableYears, registeredRecord };
}
