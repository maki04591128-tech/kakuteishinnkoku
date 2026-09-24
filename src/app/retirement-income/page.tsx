import Link from "next/link";
import { RetirementIncomeForm } from "./RetirementIncomeForm";

export default function RetirementIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">退職所得の試算</h1>
        <p className="mt-1 text-sm text-neutral-500">
          退職金(退職手当等)の収入金額と勤続年数を入力すると、国税庁タックスアンサー
          No.1420・No.2740に基づき退職所得控除額・退職所得の金額と、源泉徴収されるべき
          所得税額・住民税額の目安を試算できる。暗号資産・投資の集計とは独立した単体の
          試算画面のため、特定の年分の取引データには依存しない。
        </p>
      </header>

      <RetirementIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        退職所得は他の所得と合算しない分離課税で、「退職所得の受給に関する申告書」を
        支払者に提出していれば通常は支払時の源泉徴収・特別徴収でその年分の所得税・
        住民税の課税関係が完結し、確定申告は不要(住民税は他の所得と異なり支給年に
        完結する現年分離課税のため、翌年度の住民税額にも影響しない)。この画面は他の
        所得控除試算画面と異なり試算結果を直接DBへ登録する機能は持たない。申告書を
        提出していない場合(一律20.42%で源泉徴収される)等、還付を受けるために確定申告が
        必要なケースの参考値としても利用できる。詳しくは
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の入力欄への反映要否もあわせて確認すること。
      </p>
    </div>
  );
}
