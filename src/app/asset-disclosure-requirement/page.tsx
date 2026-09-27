import Link from "next/link";
import { AssetDisclosureRequirementForm } from "./AssetDisclosureRequirementForm";

export default function AssetDisclosureRequirementPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          国外財産調書・財産債務調書の提出要否を判定する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          暗号資産・NFT・投資資産をまとまった額で保有している場合、所得税の確定申告とは
          別に国外財産調書(国外送金等調書法5条)・財産債務調書(同法6条の2)の提出義務が
          生じることがある。暗号資産・NFTは、国外財産調書では所在が保有者本人の住所により
          判定されるため保管先の交換業者・ウォレットやマーケットプレイスが国内・国外
          いずれでも国外財産には該当しない一方、財産債務調書では所在を問わず「その他の
          財産」として財産の合計額に含める必要がある(ただしNFTは12月31日において
          暗号資産などの財産的価値を有する資産と交換できるものに限る。国税庁「NFTに
          関する税務上の取扱いについて(FAQ)」問13・問15)、という異なる取扱いになる点に
          注意する。この画面は提出要否の判定のみを行い、調書自体の作成・提出は行わない。
        </p>
      </header>

      <AssetDisclosureRequirementForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        判定結果は国税庁「国外財産調書制度(FAQ)」問2・問11、タックスアンサーNo.7456・
        No.7457、「NFTに関する税務上の取扱いについて(FAQ)」問13〜問15等の一次情報に
        基づく試算であり、財産の評価方法(時価・見積価額の算定)・調書の具体的な記載方法・
        過少申告加算税等の軽減/加重措置の詳細な適用関係までは扱わない。実際の提出義務の
        有無・記載内容は税理士等の専門家に確認すること。この試算結果を直接DBへ登録する
        機能は持たない。
      </p>
    </div>
  );
}
