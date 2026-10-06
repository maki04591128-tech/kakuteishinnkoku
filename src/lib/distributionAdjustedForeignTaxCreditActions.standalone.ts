// スタンドアロン版ビルド用の
// `@/lib/distributionAdjustedForeignTaxCreditActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d。
// `@/lib/energySavingRenovationDeductionActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の
// `saveDistributionAdjustedForeignTaxCreditRecord`/
// `deleteDistributionAdjustedForeignTaxCreditRecord`(Server Action)をそのまま再
// エクスポートするが、`src/app/actions.ts`は`"use server"`ディレクティブを持ち
// `output: "export"`の静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の
// `DistributionAdjustedForeignTaxCreditForm.tsx`(`"use client"`コンポーネント)
// から見た関数シグネチャ(`(formData: FormData) => Promise<void>`、
// `<form action={...}>`にそのまま渡せる)を変えずに、フェーズ3で抽出済みの
// コア関数(`saveDistributionAdjustedForeignTaxCreditRecordCore`/
// `deleteDistributionAdjustedForeignTaxCreditRecordCore`)を直接呼び出す実装に
// 差し替える。呼び出し元が`"use client"`コンポーネントであるため、この関数自体に
// `"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内
// 関数呼び出しになる)。
//
// これらのコア関数が依存する`TaxYearRepository`/
// `DistributionAdjustedForeignTaxCreditRecordRepository`は5-1-3bのビルド
// ターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultDistributionAdjustedForeignTaxCreditRecordRepository`)経由で参照する
// ため、このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない
// (スタンドアロンビルドでは自動的にクライアント実装側に解決される。ただし現時点では
// ブラウザ向けOPFS実装が未結線のプレースホルダーのため、実際に呼び出すと
// 「未結線です」エラーになる。5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版
// では使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版には
// そもそも存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の
// 画面遷移は`useRouter`等のフックに依存せずに済むよう、この関数内で
// `window.location.href`によるフルリロード遷移で代替する。
import {
  saveDistributionAdjustedForeignTaxCreditRecordCore,
  deleteDistributionAdjustedForeignTaxCreditRecordCore,
} from "@/lib/actions/distributionAdjustedForeignTaxCreditRecord";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { distributionAdjustedForeignTaxCreditRecordRepository } from "@/lib/repositories/defaultDistributionAdjustedForeignTaxCreditRecordRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function saveDistributionAdjustedForeignTaxCreditRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const { redirectTo } = await saveDistributionAdjustedForeignTaxCreditRecordCore(
    taxYearRepository,
    distributionAdjustedForeignTaxCreditRecordRepository,
    { year, creditJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteDistributionAdjustedForeignTaxCreditRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteDistributionAdjustedForeignTaxCreditRecordCore(
    taxYearRepository,
    distributionAdjustedForeignTaxCreditRecordRepository,
    { year },
  );

  window.location.href = redirectTo;
}
