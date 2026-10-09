// `@/lib/certifiedHousingConstructionCreditPageData`(自宅サーバー版・
// `"use server"`)と`@/lib/certifiedHousingConstructionCreditPageData.standalone`
// (スタンドアロン版)の両方から共有される戻り値の型。`"use server"`を付けた
// ファイルは非同期関数以外をexportできない制約があるため、型だけをこの共有
// ファイルに切り出し、呼び出し元
// (`CertifiedHousingConstructionCreditPageContent.tsx`)はビルドターゲットの
// 切り替え(next.config.tsのresolveAlias)を経由しないこのファイルから直接
// importする。
export interface CertifiedHousingConstructionCreditPageData {
  year: number;
  availableYears: number[];
  /** 登録済みの控除額(参考表示。未登録ならnull) */
  registeredCreditJpy: number | null;
  /** 前年(居住年)から繰り越された控除未済税額控除額(無ければnull) */
  incomingCarryforward: { originYear: number; remainingAmountJpy: string } | null;
}
