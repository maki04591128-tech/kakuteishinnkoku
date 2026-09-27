import Link from "next/link";
import { UnderreportingPenaltyAdjustmentForm } from "./UnderreportingPenaltyAdjustmentForm";

export default function UnderreportingPenaltyAdjustmentPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          国外財産調書・財産債務調書に係る過少申告加算税等の軽減・加重措置を判定する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          国外財産調書(国外送金等調書法5条)・財産債務調書(同法6条の2)を提出期限内に
          適正に提出していれば、対象資産(債務)に関する所得税・相続税の申告漏れが後日
          発覚しても過少申告加算税等が5%軽減される。逆に調書の提出等が無い場合は5%
          (国外財産調書は書類の提示等にも応じなければ10%)加重される(同法6条・6条の3)。
          死亡した方自身の所得税(準確定申告)や、財産債務調書における相続税は、この
          加重措置の対象から除外されるなど、両調書で対象の範囲が異なる点に注意する。
          機能139(提出要否判定)と組み合わせることで、調書提出のインセンティブを
          具体的な加算税率の変化として確認できる。
        </p>
      </header>

      <UnderreportingPenaltyAdjustmentForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        判定結果は国税庁「国外財産調書制度(FAQ)」問42〜44・問53、「財産債務調書制度
        (FAQ)」問47〜49・問53等の一次情報に基づく試算であり、過少申告加算税等の本税額
        そのものの計算(国税通則法65条の速算表)・重加算税との関係・実際の税務調査での
        個別事情の評価までは扱わない。実際の適用関係は税理士等の専門家に確認すること。
        この試算結果を直接DBへ登録する機能は持たない。
      </p>
    </div>
  );
}
