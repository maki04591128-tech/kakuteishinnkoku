// `@/lib/donationTaxCreditPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/donationTaxCreditPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`DonationTaxCreditPageContent.tsx`)はビルドターゲットの切り替え
// (next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
export interface DonationTaxCreditPageData {
  year: number;
  availableYears: number[];
  registeredRecord: {
    taxYear: number;
    totalTaxCreditJpy: number;
    residentTaxBasicDeductionJpy: number;
  } | null;
}
