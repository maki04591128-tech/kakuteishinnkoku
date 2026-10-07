// スタンドアロン版ビルド用の`@/lib/openingBalanceByInstitutionActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-36。
// `@/lib/openingBalanceActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`setOpeningBalanceByInstitution`/
// `deleteOpeningBalanceByInstitution`(Server Action)をそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の`import/page.tsx`から
// 見た関数シグネチャ(`(formData: FormData) => Promise<void>`、
// `<form action={...}>`にそのまま渡せる)を変えずに、フェーズ3で抽出済みのコア関数
// (`setOpeningBalanceByInstitutionCore`/`deleteOpeningBalanceByInstitutionCore`)を
// 直接呼び出す実装に差し替える。呼び出し元が`"use client"`コンポーネントであるため、
// この関数自体に`"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、
// ただのブラウザ内関数呼び出しになる)。
//
// このコア関数が依存する`TaxYearRepository`/`OpeningBalanceByInstitutionRepository`は
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultOpeningBalanceByInstitutionRepository`)経由で参照するため、このファイル
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
import type { OpeningBalanceAssetClass } from "@prisma/client";
import {
  setOpeningBalanceByInstitutionCore,
  deleteOpeningBalanceByInstitutionCore,
} from "@/lib/actions/openingBalanceByInstitution";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { openingBalanceByInstitutionRepository } from "@/lib/repositories/defaultOpeningBalanceByInstitutionRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function setOpeningBalanceByInstitution(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const assetClass = requireString(formData, "assetClass") as OpeningBalanceAssetClass;
  const symbol = requireString(formData, "symbol").trim().toUpperCase();
  const institution = requireString(formData, "institution").trim();
  const quantity = requireString(formData, "quantity");

  const { redirectTo } = await setOpeningBalanceByInstitutionCore(
    taxYearRepository,
    openingBalanceByInstitutionRepository,
    { year, assetClass, symbol, institution, quantity },
  );

  window.location.href = redirectTo;
}

export async function deleteOpeningBalanceByInstitution(
  formData: FormData,
): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteOpeningBalanceByInstitutionCore(
    openingBalanceByInstitutionRepository,
    { id, year },
  );

  window.location.href = redirectTo;
}
