// スタンドアロン版ビルド用の
// `@/lib/certifiedHousingConstructionCreditPageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3継続10回目)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元
// (`CertifiedHousingConstructionCreditPageContent.tsx`、`"use client"`
// コンポーネント)から見た関数シグネチャを変えずに、同じ`listTaxYears`・
// `getCertifiedHousingConstructionCreditRecord`・
// `getCertifiedHousingConstructionCreditCarryforward`を呼ぶ実装に差し替える。
// これらは5-1-3bのビルドターゲット切り替え機構経由で参照するため、このファイル
// 自体はPrisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。呼び出し元が
// `"use client"`コンポーネントであるため、この関数自体に`"use server"`を付けず
// ただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
import {
  getCertifiedHousingConstructionCreditCarryforward,
  getCertifiedHousingConstructionCreditRecord,
} from "@/lib/certifiedHousingConstructionCredit";
import { listTaxYears } from "@/lib/taxYear";
import type { CertifiedHousingConstructionCreditPageData } from "@/lib/certifiedHousingConstructionCreditPageData.types";

export async function getCertifiedHousingConstructionCreditPageData(
  yearParam: number | null,
): Promise<CertifiedHousingConstructionCreditPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const [registeredRecord, incomingCarryforward] = await Promise.all([
    getCertifiedHousingConstructionCreditRecord(year),
    getCertifiedHousingConstructionCreditCarryforward(year),
  ]);

  return {
    year,
    availableYears,
    registeredCreditJpy: registeredRecord ? registeredRecord.creditJpy.toNumber() : null,
    incomingCarryforward: incomingCarryforward
      ? {
          originYear: incomingCarryforward.originYear,
          remainingAmountJpy: incomingCarryforward.remainingAmountJpy.toString(),
        }
      : null,
  };
}
