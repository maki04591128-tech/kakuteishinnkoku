// スタンドアロン版ビルド用の`@/lib/donationTaxCreditActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d。
// `@/lib/earthquakeRenovationDeductionActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`saveDonationTaxCreditRecord`/
// `deleteDonationTaxCreditRecord`(Server Action)をそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の
// `DonationTaxCreditForm.tsx`(`"use client"`コンポーネント)から見た関数シグネチャ
// (`(formData: FormData) => Promise<void>`、`<form action={...}>`にそのまま渡せる)を
// 変えずに、フェーズ3で抽出済みのコア関数(`saveDonationTaxCreditRecordCore`/
// `deleteDonationTaxCreditRecordCore`)を直接呼び出す実装に差し替える。呼び出し元が
// `"use client"`コンポーネントであるため、この関数自体に`"use server"`を付けない
// (自宅サーバー版と違いRPCを経由しない、ただのブラウザ内関数呼び出しになる)。
//
// これらのコア関数が依存する`TaxYearRepository`/`DonationTaxCreditRecordRepository`は
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultDonationTaxCreditRecordRepository`)経由で参照するため、このファイル自体は
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
  saveDonationTaxCreditRecordCore,
  deleteDonationTaxCreditRecordCore,
} from "@/lib/actions/donationTaxCreditRecord";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { donationTaxCreditRecordRepository } from "@/lib/repositories/defaultDonationTaxCreditRecordRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function saveDonationTaxCreditRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const totalTaxCreditJpy = requireString(formData, "totalTaxCreditJpy");
  const residentTaxBasicDeductionJpy = requireString(formData, "residentTaxBasicDeductionJpy");

  const { redirectTo } = await saveDonationTaxCreditRecordCore(
    taxYearRepository,
    donationTaxCreditRecordRepository,
    { year, totalTaxCreditJpy, residentTaxBasicDeductionJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteDonationTaxCreditRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteDonationTaxCreditRecordCore(
    taxYearRepository,
    donationTaxCreditRecordRepository,
    { year },
  );

  window.location.href = redirectTo;
}
