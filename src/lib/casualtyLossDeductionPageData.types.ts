// `@/lib/casualtyLossDeductionPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/casualtyLossDeductionPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`CasualtyLossDeductionPageContent.tsx`)はビルドターゲットの切り替え
// (next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
export interface CasualtyLossDeductionPageData {
  year: number;
  availableYears: number[];
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
  /** 年初時点で残っている繰越雑損失の残高(発生年ごと。データ取り込み画面で登録) */
  carryforwardEntries: { originYear: number; remainingAmountJpy: string }[];
}
