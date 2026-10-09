// `@/lib/employmentIncomePageData`(自宅サーバー版・`"use server"`)と
// `@/lib/employmentIncomePageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`EmploymentIncomePageContent.tsx`)はビルドターゲットの切り替え
// (next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
export interface EmploymentIncomePageData {
  year: number;
  availableYears: number[];
  /** `/tax-estimate`と連携するため既に登録済みの給与収入(未登録ならnull) */
  registeredRecord: {
    taxYear: number;
    grossSalaryJpy: number;
    employmentIncomeJpy: number;
  } | null;
}
