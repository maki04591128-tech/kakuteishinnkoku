// スタンドアロン版ビルド用の`@/lib/angelTaxLossCarryforwardActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-15。
// `@/lib/casualtyLossCarryforwardActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`setAngelTaxLossCarryforward`/
// `deleteAngelTaxLossCarryforward`(Server Action)をそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元(`page.tsx`)から見た
// 関数シグネチャ(`(formData: FormData) => Promise<void>`、`<form action={...}>`に
// そのまま渡せる)を変えずに、フェーズ3で抽出済みのコア関数
// (`setAngelTaxLossCarryforwardCore`/`deleteAngelTaxLossCarryforwardCore`)を
// 直接呼び出す実装に差し替える。
//
// なお`page.tsx`は(`CasualtyLossDeductionForm.tsx`等と異なり)`"use client"`を
// 付けないServer Componentのままで、この2関数を直接`<form action={...}>`に渡している。
// React Server Componentsの仕様上、`"use server"`を持たない関数をServer Component
// から(Client Componentを介さず)直接クライアント側の`<form action={...}>`に渡す
// ことはできないため、本来は`page.tsx`を`"use client"`コンポーネントに切り出す
// 追加対応が必要になる(5-1-3d-13の`certified-housing-construction-credit/page.tsx`
// で判明済みの既知の制約。README「現在の最優先事項」フェーズ5-1-3d本体の完了後に
// まとめて対応する想定。現時点では`src/app/actions.ts`自体がまだ退避対象に
// 入っておらず`build:standalone`は別のエラー(Server Actions are not supported
// with static export)で先に失敗するため、この問題はまだ表面化していない)。
//
// このコア関数が依存する`TaxYearRepository`/`AngelTaxLossCarryforwardRepository`は
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultAngelTaxLossCarryforwardRepository`)経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは自動的に
// クライアント実装側に解決される。ただし現時点ではブラウザ向けOPFS実装が未結線の
// プレースホルダーのため、実際に呼び出すと「未結線です」エラーになる。5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版では
// 使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版にはそもそも
// 存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の画面遷移は
// `useRouter`等のフックに依存せずに済むよう、この関数内で`window.location.href`による
// フルリロード遷移で代替する。
import {
  deleteAngelTaxLossCarryforwardCore,
  setAngelTaxLossCarryforwardCore,
} from "@/lib/actions/angelTaxLossCarryforward";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { angelTaxLossCarryforwardRepository } from "@/lib/repositories/defaultAngelTaxLossCarryforwardRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function setAngelTaxLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setAngelTaxLossCarryforwardCore(
    taxYearRepository,
    angelTaxLossCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteAngelTaxLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteAngelTaxLossCarryforwardCore(
    angelTaxLossCarryforwardRepository,
    { id, year },
  );

  window.location.href = redirectTo;
}
