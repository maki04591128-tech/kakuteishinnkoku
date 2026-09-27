import Link from "next/link";
import { InvestmentTrustDistributionForm } from "./InvestmentTrustDistributionForm";

export default function InvestmentTrustDistributionPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          投資信託の分配金(普通分配金・特別分配金)の区分を試算する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          追加型(オープン型)投資信託の収益分配金を、課税対象の「普通分配金(配当所得)」と
          非課税の「特別分配金(元本払戻金)」に区分する(所得税法9条1項11号・同法施行令27条)。
          分配落ち後基準価額が分配前個別元本を下回る場合、その差額(分配金額が上限)が
          元本の払戻しとみなされ非課税になり、個別元本はその分だけ減少して次回以降の
          分配・将来の売却時の取得費計算に引き継がれる。分配金額・個別元本・基準価額は
          いずれも目論見書・運用報告書・分配金明細に記載される「1万口当たり」の金額を
          入力する。
        </p>
      </header>

      <InvestmentTrustDistributionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は
        持たない(分配金の課税区分そのものの計算であり、特定口座(源泉徴収あり)であれば
        通常は証券会社側で自動計算・徴収されるため。外貨預金の為替差損益(
        <Link href="/foreign-currency-deposit" className="underline">
          /foreign-currency-deposit
        </Link>
        )等と同様の単体の試算画面)。この画面で求めた「普通分配金額の合計」は、
        課税方式(総合課税・申告分離課税・申告不要)を選ぶ配当所得の税額シミュレーション(
        <Link href="/dividend-simulation" className="underline">
          /dividend-simulation
        </Link>
        )の入力として用いること。特定口座の年間取引報告書上の分配金額と本ツールの試算結果が
        一致するかはユーザー自身で確認すること。期中の追加購入・一部解約による保有口数の
        変動は対象外。上場投資法人(J-REIT)の出資等減少分配(資本の払戻し)は別制度のため
        <Link href="/capital-return-distribution" className="underline">
          /capital-return-distribution
        </Link>
        で試算できる。
      </p>
    </div>
  );
}
