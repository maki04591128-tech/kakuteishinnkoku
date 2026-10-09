// `@/lib/widowSingleParentDeductionPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/widowSingleParentDeductionPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`WidowSingleParentDeductionPageContent.tsx`)はビルドターゲットの
// 切り替え(next.config.tsのresolveAlias)を経由しないこのファイルから直接
// importする。
export interface WidowSingleParentDeductionPageData {
  year: number;
  availableYears: number[];
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの寡婦・ひとり親控除額(未登録ならnull) */
  registeredCategoryDeduction: { incomeTaxAmountJpy: number; residentTaxAmountJpy: number } | null;
  /** 同様に既に登録済みの勤労学生控除額(未登録ならnull) */
  registeredWorkingStudentDeduction:
    | { incomeTaxAmountJpy: number; residentTaxAmountJpy: number }
    | null;
}
