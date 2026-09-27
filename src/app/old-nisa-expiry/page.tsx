import Link from "next/link";
import { OldNisaExpiryForm } from "./OldNisaExpiryForm";

export default function OldNisaExpiryPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          旧NISA(一般NISA・つみたてNISA)の非課税期間終了時の取得価額付け替えを試算する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          令和5年(2023年)までに投資した旧NISA(一般NISAは5年間、つみたてNISAは20年間の
          非課税期間)は、令和6年(2024年)以後の新NISAへロールオーバー(非課税期間終了時に
          新たな非課税投資枠へ持ち込む制度)することができない(制度は令和5年分をもって
          廃止)。非課税期間終了までに売却しなかった残高は、翌年最初の営業日に課税口座
          (特定口座・一般口座)へ、非課税期間最終年の最終営業日の終値を新しい取得価額として
          付け替えたうえで自動的に払い出される(措置法37条の14第7項・第16項)。銘柄ごとに
          買付年・買付数量・買付時の取得費・非課税期間最終年の最終営業日終値を入力すると、
          非課税期間の最終年、付け替え後の新しい取得価額、非課税のまま確定する含み益
          (値下がりしていた場合は切り捨てられる含み損)を試算する。
        </p>
      </header>

      <OldNisaExpiryForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        非課税期間最終年の最終営業日の終値(基準価額)は本ツールが自動取得しないため、
        保有先の証券会社の取引履歴・基準価額情報等で確認して入力すること。非課税期間中に
        値下がりしていた場合、その値下がり損は切り捨てられ他の譲渡益との損益通算・繰越控除
        の対象にできない点、また払い出し後に価格が回復しても付け替え後の(低い)取得価額を
        基準に課税される点に注意すること。試算結果の新しい取得価額(newCostBasisJpy)は、
        翌年分以後の課税口座での譲渡所得計算のため、
        <Link href="/import" className="underline">
          /import
        </Link>
        の「期首残高(前年繰越残高)」セクションへ手入力で登録することを想定した単体の
        試算画面で、この試算結果を直接DBへ登録する機能は持たない(
        <Link href="/exit-tax" className="underline">
          /exit-tax
        </Link>
        と同様の位置付け)。ジュニアNISAは非課税期間・払出し時の取扱いが異なる別制度のため
        対象外。
      </p>
    </div>
  );
}
