// `@/lib/dependentDeductionPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/dependentDeductionPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`DependentDeductionPageContent.tsx`)はビルドターゲットの切り替え
// (next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
export interface DependentDeductionPageData {
  year: number;
  availableYears: number[];
  defaultTaxpayerTotalIncomeJpy: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの配偶者控除額(未登録ならnull) */
  registeredSpouseDeductionJpy: number | null;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの扶養控除額(未登録ならnull) */
  registeredDependentDeductionJpy: number | null;
}
