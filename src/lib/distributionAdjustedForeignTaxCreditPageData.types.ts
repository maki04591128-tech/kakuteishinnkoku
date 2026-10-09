// `@/lib/distributionAdjustedForeignTaxCreditPageData`(自宅サーバー版・
// `"use server"`)と`@/lib/distributionAdjustedForeignTaxCreditPageData.standalone`
// (スタンドアロン版)の両方から共有される戻り値の型。`"use server"`を付けた
// ファイルは非同期関数以外をexportできない制約があるため、型だけをこの共有
// ファイルに切り出し、呼び出し元
// (`DistributionAdjustedForeignTaxCreditPageContent.tsx`)はビルドターゲットの
// 切り替え(next.config.tsのresolveAlias)を経由しないこのファイルから直接
// importする。
export interface DistributionAdjustedForeignTaxCreditPageData {
  year: number;
  availableYears: number[];
  /** `/import`で登録済みの配当・分配金取引から自動集計した分配時調整外国税相当額の初期値 */
  autoDistributionAdjustedForeignTaxJpy: string;
  /** 登録済みの控除額(参考表示。未登録ならnull) */
  registeredCreditJpy: number | null;
}
