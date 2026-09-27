import Link from "next/link";
import { CryptoIncomeClassificationForm } from "./CryptoIncomeClassificationForm";

export default function CryptoIncomeClassificationPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          暗号資産取引の所得区分(事業所得・雑所得)を判定する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          暗号資産取引による利益は原則として雑所得(その他雑所得)に区分されるが、
          国税庁「暗号資産等に関する税務上の取扱いについて(FAQ)」問2-2「暗号資産取引の
          所得区分」(令和7年12月更新)により、その年の収入金額が300万円を超える場合は
          帳簿書類の保存の有無に応じて事業所得又は雑所得(業務に係る雑所得)に、既存の
          事業に付随した取引である場合は収入金額を問わず事業所得に区分される。この画面は
          この所得区分の判定のみを行う。
        </p>
      </header>

      <CryptoIncomeClassificationForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールの既存の暗号資産の損益計算(
        <Link href="/import" className="underline">
          /import
        </Link>
        の暗号資産の取引フォーム等)は、暗号資産取引の所得区分を雑所得(その他雑所得)と
        決め打ちして集計している。この画面での判定結果が事業所得又は雑所得(業務に係る
        雑所得)になる場合、それらの所得金額の実額計算(帳簿に基づく収入・経費の計算)・
        青色申告特別控除の適用・純損失又は雑所得の損失の繰越控除の可否・開業届出書等の
        提出手続は本ツールでは行わないため(今後の課題)、税理士等の専門家に確認すること。
        判定結果が雑所得(その他雑所得)になる場合に限り、既存の損益計算結果をそのまま
        `/tax-estimate`の雑所得に反映できる。この試算結果を直接DBへ登録する機能は持たない。
      </p>
    </div>
  );
}
