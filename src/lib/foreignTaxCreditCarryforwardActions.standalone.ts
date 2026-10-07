// スタンドアロン版ビルド用の`@/lib/foreignTaxCreditCarryforwardActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-31。
// `@/lib/futuresLossCarryforwardActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`setForeignTaxCreditCarryforward`/
// `deleteForeignTaxCreditCarryforward`(Server Action)をそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の`import/page.tsx`から
// 見た関数シグネチャ(`(formData: FormData) => Promise<void>`、
// `<form action={...}>`にそのまま渡せる)を変えずに、フェーズ3で抽出済みの
// コア関数(`setForeignTaxCreditCarryforwardCore`/
// `deleteForeignTaxCreditCarryforwardCore`)を直接呼び出す実装に差し替える。
// 呼び出し元が`"use client"`コンポーネントであるため、この関数自体に`"use server"`を
// 付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内関数呼び出しになる)。
//
// このコア関数が依存する`TaxYearRepository`/`ForeignTaxCreditCarryforwardRepository`は
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultForeignTaxCreditCarryforwardRepository`)経由で参照するため、このファイル
// 自体はPrisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアント実装側に解決される。ただし現時点ではブラウザ向けOPFS実装が
// 未結線のプレースホルダーのため、実際に呼び出すと「未結線です」エラーになる。
// 5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版では
// 使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版にはそもそも
// 存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の画面遷移は
// `useRouter`等のフックに依存せずに済むよう、この関数内で`window.location.href`による
// フルリロード遷移で代替する。
import {
  setForeignTaxCreditCarryforwardCore,
  deleteForeignTaxCreditCarryforwardCore,
} from "@/lib/actions/foreignTaxCreditCarryforward";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { foreignTaxCreditCarryforwardRepository } from "@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function setForeignTaxCreditCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setForeignTaxCreditCarryforwardCore(
    taxYearRepository,
    foreignTaxCreditCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteForeignTaxCreditCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteForeignTaxCreditCarryforwardCore(
    foreignTaxCreditCarryforwardRepository,
    { id, year },
  );

  window.location.href = redirectTo;
}
