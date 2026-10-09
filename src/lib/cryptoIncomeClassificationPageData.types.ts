// `@/lib/cryptoIncomeClassificationPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/cryptoIncomeClassificationPageData.standalone`(スタンドアロン版)の
// 両方から共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出す。
export interface CryptoIncomeClassificationPageData {
  year: number;
  availableYears: number[];
  /** この年に登録済みの暗号資産(現物取引)の収入金額合計。0ならまだ未登録 */
  defaultTotalRevenueJpy: number;
}
