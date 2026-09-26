import Link from "next/link";
import { StockOptionTaxForm } from "./StockOptionTaxForm";

export default function StockOptionTaxPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">ストックオプションの税額試算</h1>
        <p className="mt-1 text-sm text-neutral-500">
          会社から付与されたストックオプション(措置法29条の2、国税庁タックスアンサーNo.1540・
          No.1543)の税額を試算する。税制適格の要件(権利行使価額が付与契約締結時の価額以上・
          権利行使期間(決議日後2年〜10年、設立5年未満の非上場会社は15年)・その年中の権利行使
          価額の合計が上限額(上場会社1,200万円/非上場会社2,400万円又は3,600万円)以下)を
          満たす部分は権利行使時には課税されず株式売却時にまとめて申告分離課税(20.315%)される
          のに対し、満たさない部分(税制非適格)は権利行使時に給与所得等として総合課税され、
          売却時にさらに譲渡所得として課税される2段階課税になる。暗号資産・投資の年間集計とは
          独立した単体の試算画面のため、特定の年分の取引データには依存しない。
        </p>
      </header>

      <StockOptionTaxForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        自動判定するのは上記3要件のみで、付与対象者(取締役等・社外高度人材)が大口株主等に
        該当しないこと・無償での付与・譲渡制限・発行会社等による株式の管理方法等の要件は
        ユーザー自身の確認事項とする(「その他の税制適格要件」チェック)。権利行使期間の判定は
        契約書上の行使可能期間ではなく実際の権利行使日からの近似値。この試算結果を直接DBへ
        登録する機能は持たない(
        <Link href="/exit-tax" className="underline">
          /exit-tax
        </Link>
        等と同様の位置付け)。権利行使時の給与所得等は
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」へ、株式売却時の譲渡所得は他の株式等の譲渡損益と合算のうえ
        手入力で反映すること。
      </p>
    </div>
  );
}
