import Link from "next/link";
import { VacantHouseSaleDeductionForm } from "./VacantHouseSaleDeductionForm";

export default function VacantHouseSaleDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          被相続人の居住用財産(空き家)を譲渡した場合の税額試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額・取得費・譲渡費用・相続人の数を入力すると、被相続人の居住用財産
          (空き家)を売ったときの特例(措置法35条3項)による特別控除(3,000万円、
          相続人が3人以上の場合は2,000万円)を適用した譲渡所得の税額(申告分離課税・
          長期譲渡所得)を試算できる。居住用財産(マイホーム)の3,000万円特別控除
          (措置法35条1項)とは要件・控除限度額が異なる別制度のため、
          <Link href="/home-sale-deduction" className="underline">
            /home-sale-deduction
          </Link>
          とは独立した単体の試算画面とした。
        </p>
      </header>

      <VacantHouseSaleDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールが自動判定するのは譲渡対価が1億円以下かどうかのみで、家屋の建築時期
        (昭和56年5月31日以前)・被相続人が相続開始直前まで一人で居住していたこと・
        相続開始から譲渡まで事業用・貸付用・居住用に供されていないこと・特別の関係が
        ある者への譲渡でないこと・耐震基準適合または取壊しの期限等、その他の適用要件の
        判定は行わない。所有期間10年超の居住用財産の軽減税率の特例(措置法31条の3)、
        居住用財産の3,000万円特別控除(措置法35条1項)との重複適用の可否等、他の特例も
        対象外。実際の申告内容は国税庁タックスアンサーNo.3306や税理士等の専門家に
        確認すること。
      </p>
    </div>
  );
}
