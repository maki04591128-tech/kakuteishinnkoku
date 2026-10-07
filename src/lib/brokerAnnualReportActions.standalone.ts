// スタンドアロン版ビルド用の`@/lib/brokerAnnualReportActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-19。
// `@/lib/homeReplacementLossCarryforwardActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`setBrokerAnnualReport`
// (Server Action)をそのまま再エクスポートするが、`src/app/actions.ts`は
// `"use server"`ディレクティブを持ち`output: "export"`の静的ビルドでは使えない
// (5-1-3a参照)。そのため呼び出し元の`AnnualReportTextImportForm.tsx`
// (`"use client"`コンポーネント)から見た関数シグネチャ
// (`(formData: FormData) => Promise<void>`、`<form action={...}>`にそのまま
// 渡せる)を変えずに、フェーズ3で抽出済みのコア関数(`setBrokerAnnualReportCore`)を
// 直接呼び出す実装に差し替える。呼び出し元が`"use client"`コンポーネントであるため、
// この関数自体に`"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、
// ただのブラウザ内関数呼び出しになる)。
//
// このコア関数が依存する`TaxYearRepository`/`BrokerAnnualReportRepository`は
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultBrokerAnnualReportRepository`)経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは自動的に
// クライアント実装側に解決される。ただし現時点ではブラウザ向けOPFS実装が未結線の
// プレースホルダーのため、実際に呼び出すと「未結線です」エラーになる。5-1-3b参照)。
//
// `accountType`の型は、呼び出し元(`AnnualReportTextImportForm.tsx`)が元々
// `@prisma/client`に依存しない`AnnualReportAccountType`(`NISA`を含まない
// サブセット)で管理しているため、ここでも`@prisma/client`の
// `InvestmentAccountType`をimportせずそれを使う
// (`SetBrokerAnnualReportInput.accountType`への代入可能なサブセット)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版では
// 使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版にはそもそも
// 存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の画面遷移は
// `useRouter`等のフックに依存せずに済むよう、この関数内で`window.location.href`による
// フルリロード遷移で代替する。
import {
  setBrokerAnnualReportCore,
  deleteBrokerAnnualReportCore,
} from "@/lib/actions/brokerAnnualReport";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { brokerAnnualReportRepository } from "@/lib/repositories/defaultBrokerAnnualReportRepository";
import type { AnnualReportAccountType } from "@/lib/investment/annualReportCsv";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

function optionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

export async function setBrokerAnnualReport(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const broker = requireString(formData, "broker");
  const accountType = requireString(formData, "accountType") as AnnualReportAccountType;
  const proceedsJpy = requireString(formData, "proceedsJpy");
  const acquisitionCostJpy = requireString(formData, "acquisitionCostJpy");
  const dividendJpy = optionalString(formData, "dividendJpy") ?? "0";

  const { redirectTo } = await setBrokerAnnualReportCore(
    taxYearRepository,
    brokerAnnualReportRepository,
    { year, broker, accountType, proceedsJpy, acquisitionCostJpy, dividendJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteBrokerAnnualReport(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteBrokerAnnualReportCore(brokerAnnualReportRepository, {
    id,
    year,
  });

  window.location.href = redirectTo;
}
