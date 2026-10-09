// `@/lib/foreignTaxCreditPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/foreignTaxCreditPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`ForeignTaxCreditPageContent.tsx`)はビルドターゲットの切り替え
// (next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
export interface ForeignTaxCreditPageData {
  year: number;
  availableYears: number[];
  /** 年初時点で残っている繰越控除限度超過額の残高(発生年ごと。データ取り込み画面で登録) */
  carryforwardEntries: { originYear: number; remainingAmountJpy: string }[];
  /** 年初時点で残っている繰越控除余裕額の残高(発生年ごと。データ取り込み画面で登録) */
  spareLimitCarryforwardEntries: { originYear: number; remainingAmountJpy: string }[];
  /** `/import`に登録済みの国外源泉配当等・譲渡益から自動集計した国外所得金額(課税口座分) */
  autoForeignSourceIncomeJpy: string;
  /** `/import`に登録済みの国外源泉配当等から自動集計した外国所得税額(課税口座分) */
  autoForeignIncomeTaxPaidJpy: string;
  /** この年分として登録済みの外国税額控除の合計控除額・所得税分・住民税分(下書きCSV・/tax-estimate用)。未登録ならnull */
  registeredTotalCreditJpy: {
    totalCreditJpy: number;
    nationalTaxCreditJpy: number;
    residentTaxCreditJpy: number;
  } | null;
}
