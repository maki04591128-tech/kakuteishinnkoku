// `@/lib/angelTaxLossCarryforwardPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/angelTaxLossCarryforwardPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`AngelTaxLossCarryforwardPageContent.tsx`)はビルドターゲットの切り替え
// (next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
export interface AngelTaxLossCarryforwardPageData {
  year: number;
  availableYears: number[];
  /** 年初時点で残っている繰越損失の残高(発生年ごと) */
  carryforwardEntries: { id: number; originYear: number; remainingAmountJpy: string }[];
}
