// `@/lib/dividendSimulationPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/dividendSimulationPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出す。
export interface DividendSimulationPageData {
  year: number;
  availableYears: number[];
  defaultDividendJpy: number;
  defaultDividendHalfCreditJpy: number;
  defaultDividendQuarterCreditJpy: number;
  defaultDividendNoCreditJpy: number;
  /** この年に登録済みの株式等譲渡損失(赤字)。損益通算の初期値として提案する */
  defaultAvailableListedStockLossJpy: number;
  defaultNonListedDividendJpy: number;
  defaultNonListedDividendHalfCreditJpy: number;
  defaultNonListedDividendQuarterCreditJpy: number;
  defaultNonListedDividendNoCreditJpy: number;
}
