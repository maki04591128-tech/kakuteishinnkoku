import Link from "next/link";
import { CapitalReturnDistributionForm } from "./CapitalReturnDistributionForm";

export default function CapitalReturnDistributionPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          上場投資法人(J-REIT)等の出資等減少分配に伴うみなし配当・みなし譲渡損益を試算する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          上場投資法人(J-REIT)等が支払う利益超過分配金のうち、出資剰余金を原資とする
          「出資等減少分配」(通常「その他の利益超過分配金」等と呼ばれる部分)は、
          通常の配当所得ではなく資本の払戻しとして扱われる(所得税法24条1項)。分配額のうち
          投資法人の資本金等の額に対応する部分を超える部分は配当所得とみなされ(みなし配当。
          同法25条1項4号)、それ以外の部分は投資口の一部を譲渡したものとみなして(措置法
          37条の11第3項)みなし譲渡損益を計算するとともに、残りの投資口の取得価額も減額
          調整する(同法施行令114条1項2号)。払戻等割合・みなし配当額(1口当たり)は投資法人が
          分配のたびに投資主へ通知する値をそのまま入力する。
        </p>
      </header>

      <CapitalReturnDistributionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは投資信託の分配金の区分計算(
        <Link href="/investment-trust-distribution" className="underline">
          /investment-trust-distribution
        </Link>
        )等と同様、この試算結果を直接DBへ登録する機能は持たない単体の試算画面。ここで求めた
        「みなし配当額の合計」は配当所得の課税方式シミュレーション(
        <Link href="/dividend-simulation" className="underline">
          /dividend-simulation
        </Link>
        )の入力として、「みなし譲渡損益の合計」は他の上場株式等の譲渡損益との通算対象として、
        それぞれ手動で反映すること。「一時差異等調整引当額」等、出資等減少分配に該当しない
        利益超過分配金は通常の利益分配金と合算した配当所得として扱われ、取得価額の調整も
        みなし譲渡損益も生じない。特定口座(源泉徴収あり)を株式数比例配分方式で利用している
        場合や、NISA口座で保有する場合の取扱いはユーザー自身で確認すること。
      </p>
    </div>
  );
}
