import Link from "next/link";
import { CryptoUnknownCostBasisForm } from "./CryptoUnknownCostBasisForm";

export default function CryptoUnknownCostBasisPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          暗号資産の取得価額が分からない場合の概算取得費を試算する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          国税庁「暗号資産等に関する税務上の取扱いについて(FAQ)」問2-7「暗号資産の取得価額や
          売却価額が分からない場合」により、取引履歴を残しておらず取得価額が確認できない
          暗号資産取引は、収入金額(売却価額等)の5%相当額を取得価額とすることが認められる
          (所基通達48の2-4)。取得価額が実際に確認できる取引はその実額を入力すること。
        </p>
      </header>

      <CryptoUnknownCostBasisForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールの既存の暗号資産の損益計算(
        <Link href="/import" className="underline">
          /import
        </Link>
        の暗号資産の取引フォーム等)は総平均法/移動平均法による年初来の取得履歴の
        プール計算を前提としており、取得履歴を丸ごと欠く取引にこの5%の概算取得費を
        部分適用する形では整合しない。この画面は取得価額が全く分からない取引のみを
        対象にした既存計算とは独立の単体試算であり、結果をDBへ登録する機能は持たない。
        まずは暗号資産交換業者へ「年間取引報告書」の(再)交付を依頼するか、購入・売却時に
        使った銀行口座の入出金記録等から取得価額を確認できないか試みたうえで、それでも
        確認できない場合に限りこの試算を使うこと。
      </p>
    </div>
  );
}
