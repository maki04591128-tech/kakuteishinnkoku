import Link from "next/link";
import { RenovationCreditCombinationForm } from "./RenovationCreditCombinationForm";

export default function RenovationCreditCombinationPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          住宅特定改修特別税額控除の併用時のB限度額合算判定
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          住宅耐震改修(措置法41条の19の2)・バリアフリー改修・省エネ改修・多世帯同居改修・
          耐久性向上改修・子育て対応改修(措置法41条の19の3。国税庁タックスアンサー
          No.1219・No.1220・No.1222・No.1224・No.1227・No.1228)のうち2つ以上を同一年中に
          併せて行った場合、B(増改築等工事費用分)の1,000万円の限度額は各改修工事のAの
          合計額を控除した額が限度になる。各改修工事の単体の試算画面(
          <Link href="/earthquake-renovation-deduction" className="underline">
            住宅耐震改修
          </Link>
          ・
          <Link href="/barrier-free-renovation-deduction" className="underline">
            バリアフリー
          </Link>
          ・
          <Link href="/energy-saving-renovation-deduction" className="underline">
            省エネ
          </Link>
          ・
          <Link href="/multi-household-renovation-deduction" className="underline">
            多世帯同居
          </Link>
          ・
          <Link href="/durability-improvement-renovation-deduction" className="underline">
            耐久性向上
          </Link>
          ・
          <Link href="/child-rearing-renovation-deduction" className="underline">
            子育て対応
          </Link>
          )で計算したA(控除対象限度額までの部分)・標準的な費用の額をこの画面に入力すると、
          併用後のB・控除額の合計を再計算する。
        </p>
      </header>

      <RenovationCreditCombinationForm />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          各改修工事の適用要件(合計所得金額・床面積・工事内容等)の判定は、対応する単体
          モジュールの試算画面で行うこと。この画面は、それらの画面で計算されたA・標準的な
          費用の額を入力し、併用時のBの限度額の合算判定のみを行う(バリアフリー改修等は
          <code>eligible: true</code>
          であること、住宅耐震改修はA自体が常に対象であることを確認した上で入力する)。
        </p>
        <p>
          この試算結果は、単体モジュールに個別に登録した控除額の合計ではなく、この画面が
          計算した控除額の合計を`/tax-estimate`等へ手入力で反映すること(単体モジュールへの
          登録内容(下書きCSVの税額控除欄への自動反映)は変更しない)。
        </p>
      </div>
    </div>
  );
}
