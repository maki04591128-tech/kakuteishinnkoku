// `@/lib/mortgageDeductionPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/mortgageDeductionPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`MortgageDeductionPageContent.tsx`)はビルドターゲットの切り替え
// (next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
export interface MortgageDeductionPageData {
  year: number;
  availableYears: number[];
  registeredRecord: {
    taxYear: number;
    nationalTaxCreditJpy: number;
    residentTaxCreditJpy: number;
  } | null;
}
