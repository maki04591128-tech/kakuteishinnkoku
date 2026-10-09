// `@/lib/residentTaxAdjustmentDeductionPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/residentTaxAdjustmentDeductionPageData.standalone`(スタンドアロン版)の
// 両方から共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`ResidentTaxAdjustmentDeductionPageContent.tsx`)はビルドターゲットの
// 切り替え(next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
export interface ResidentTaxAdjustmentDeductionPageData {
  year: number;
  availableYears: number[];
  /** 登録済みの調整控除額(参考表示。未登録ならnull) */
  registeredRecord: { taxYear: number; adjustmentDeductionJpy: number } | null;
}
