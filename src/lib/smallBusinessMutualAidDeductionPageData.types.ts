// `@/lib/smallBusinessMutualAidDeductionPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/smallBusinessMutualAidDeductionPageData.standalone`(スタンドアロン版)の
// 両方から共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`SmallBusinessMutualAidDeductionPageContent.tsx`)はビルドターゲットの
// 切り替え(next.config.tsのresolveAlias)を経由しないこのファイルから直接
// importする。
export interface SmallBusinessMutualAidDeductionPageData {
  year: number;
  availableYears: number[];
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの控除額(未登録ならnull) */
  registeredDeductionJpy: number | null;
}
