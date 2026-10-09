// スタンドアロン版ビルド用の`@/lib/employmentIncomePageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3継続)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`EmploymentIncomePageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`・`getEmploymentIncomeRecord`を呼ぶ実装に差し替える。これらは
// 5-1-3bのビルドターゲット切り替え機構経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。呼び出し元が
// `"use client"`コンポーネントであるため、この関数自体に`"use server"`を付けず
// ただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
import { listTaxYears } from "@/lib/taxYear";
import { getEmploymentIncomeRecord } from "@/lib/employmentIncome";
import type { EmploymentIncomePageData } from "@/lib/employmentIncomePageData.types";

export async function getEmploymentIncomePageData(
  yearParam: number | null,
): Promise<EmploymentIncomePageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const record = await getEmploymentIncomeRecord(year);
  const registeredRecord = record
    ? {
        taxYear: record.taxYear,
        grossSalaryJpy: record.grossSalaryJpy.toNumber(),
        employmentIncomeJpy: record.employmentIncomeJpy.toNumber(),
      }
    : null;

  return { year, availableYears, registeredRecord };
}
