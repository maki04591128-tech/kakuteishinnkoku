// スタンドアロン版ビルド用の`@/lib/foreignTaxCreditActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d。
// `@/lib/certifiedHousingConstructionCreditActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の4つのServer Actionをそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の`ForeignTaxCreditForm.tsx`
// (`"use client"`コンポーネント)から見た関数シグネチャ
// (`(formData: FormData) => Promise<void>`、`<form action={...}>`にそのまま渡せる)を
// 変えずに、フェーズ3・本ステップ(5-1-3d-16)で抽出済みのコア関数
// (`saveForeignTaxCreditRecordCore`/`deleteForeignTaxCreditRecordCore`/
// `carryForwardForeignTaxCreditExcessCore`/
// `carryForwardForeignTaxCreditSpareLimitCore`)を直接呼び出す実装に差し替える。
// 呼び出し元が`"use client"`コンポーネントであるため、この関数自体に`"use server"`を
// 付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内関数呼び出しになる)。
//
// これらのコア関数が依存する`TaxYearRepository`/`ForeignTaxCreditRecordRepository`/
// `ForeignTaxCreditCarryforwardRepository`/
// `ForeignTaxCreditSpareLimitCarryforwardRepository`は5-1-3bおよび本ステップの
// ビルドターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultForeignTaxCreditRecordRepository`/
// `defaultForeignTaxCreditCarryforwardRepository`/
// `defaultForeignTaxCreditSpareLimitCarryforwardRepository`)経由で参照するため、この
// ファイル自体はPrisma/クライアントDBどちらの実装かを意識しない(スタンドアロン
// ビルドでは自動的にクライアント実装側に解決される。ただし現時点ではブラウザ向けOPFS
// 実装が未結線のプレースホルダーのため、実際に呼び出すと「未結線です」エラーになる。
// 5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版では
// 使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版にはそもそも
// 存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の画面遷移は
// `useRouter`等のフックに依存せずに済むよう、この関数内で`window.location.href`による
// フルリロード遷移で代替する。
import {
  saveForeignTaxCreditRecordCore,
  deleteForeignTaxCreditRecordCore,
} from "@/lib/actions/foreignTaxCreditRecord";
import { carryForwardForeignTaxCreditExcessCore } from "@/lib/actions/foreignTaxCreditCarryforward";
import { carryForwardForeignTaxCreditSpareLimitCore } from "@/lib/actions/foreignTaxCreditSpareLimitCarryforward";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { foreignTaxCreditRecordRepository } from "@/lib/repositories/defaultForeignTaxCreditRecordRepository";
import { foreignTaxCreditCarryforwardRepository } from "@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository";
import { foreignTaxCreditSpareLimitCarryforwardRepository } from "@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function saveForeignTaxCreditRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const totalCreditJpy = requireString(formData, "totalCreditJpy");
  const nationalTaxCreditJpy = requireString(formData, "nationalTaxCreditJpy");
  const residentTaxCreditJpy = requireString(formData, "residentTaxCreditJpy");

  const { redirectTo } = await saveForeignTaxCreditRecordCore(
    taxYearRepository,
    foreignTaxCreditRecordRepository,
    { year, totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteForeignTaxCreditRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteForeignTaxCreditRecordCore(
    taxYearRepository,
    foreignTaxCreditRecordRepository,
    { year },
  );

  window.location.href = redirectTo;
}

export async function carryForwardForeignTaxCreditExcess(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const entriesJson = requireString(formData, "carryforwardToNextYearJson");
  const entries = JSON.parse(entriesJson) as { originYear: number; remainingAmountJpy: string }[];

  const { redirectTo } = await carryForwardForeignTaxCreditExcessCore(
    taxYearRepository,
    foreignTaxCreditCarryforwardRepository,
    { year, entries },
  );

  window.location.href = redirectTo;
}

export async function carryForwardForeignTaxCreditSpareLimit(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const entriesJson = requireString(formData, "spareLimitCarryforwardToNextYearJson");
  const entries = JSON.parse(entriesJson) as { originYear: number; remainingAmountJpy: string }[];

  const { redirectTo } = await carryForwardForeignTaxCreditSpareLimitCore(
    taxYearRepository,
    foreignTaxCreditSpareLimitCarryforwardRepository,
    { year, entries },
  );

  window.location.href = redirectTo;
}
