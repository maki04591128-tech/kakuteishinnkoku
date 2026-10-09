// `@/lib/medicalExpenseDeductionPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/medicalExpenseDeductionPageData.standalone`(スタンドアロン版)の
// 両方から共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`MedicalExpenseDeductionPageContent.tsx`)はビルドターゲットの
// 切り替え(next.config.tsのresolveAlias)を経由しないこのファイルから直接
// importする。
export interface MedicalExpenseDeductionPageData {
  year: number;
  availableYears: number[];
  defaultTotalIncomeJpy: number;
  /** `/tax-estimate`と連携するため既にこの年分として登録済みの医療費控除額(未登録ならnull) */
  registeredDeductionJpy: number | null;
  /** 同じく登録済みのセルフメディケーション税制による控除額(未登録ならnull) */
  registeredSelfMedicationDeductionJpy: number | null;
}
