// `@/lib/durabilityImprovementRenovationDeductionPageData`(自宅サーバー版・
// `"use server"`)と`@/lib/durabilityImprovementRenovationDeductionPageData.standalone`
// (スタンドアロン版)の両方から共有される戻り値の型。`"use server"`を付けたファイルは
// 非同期関数以外をexportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`DurabilityImprovementRenovationDeductionPageContent.tsx`)はビルド
// ターゲットの切り替え(next.config.tsのresolveAlias)を経由しないこのファイルから
// 直接importする。
export interface DurabilityImprovementRenovationDeductionPageData {
  year: number;
  availableYears: number[];
  /** 登録済みの控除額(参考表示。未登録ならnull) */
  registeredCreditJpy: number | null;
}
