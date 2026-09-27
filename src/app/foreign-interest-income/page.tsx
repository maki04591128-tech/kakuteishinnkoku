import Link from "next/link";
import { ForeignInterestIncomeForm } from "./ForeignInterestIncomeForm";

export default function ForeignInterestIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          海外の金融機関の預金利子(総合課税)の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          国内の金融機関の預金利子は源泉分離課税(源泉徴収のみで課税関係が終了)だが、これは
          租税特別措置法3条1項の「国内において支払を受けるべき」利子等に限られるため、海外の
          金融機関へ直接預け入れた預金の利子はこの規定の対象外となり、原則である総合課税
          (所得税法21条・89条)として確定申告が必要になる。受け取った利息を通貨・受取時点の
          円換算レートごとに入力すると、必要経費の控除が無い(所得税法23条2項)利子所得の金額を
          円換算して合計する。暗号資産・投資の集計とは独立した単体の試算画面のため、特定の
          年分の取引データには依存しない。
        </p>
      </header>

      <ForeignInterestIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は持たない
        (海外預金の利子所得は所得控除ではなく所得区分そのものの計算であり、`IncomeDeduction`の
        ような控除額の登録とは性質が異なるため。一時所得(
        <Link href="/occasional-income" className="underline">
          /occasional-income
        </Link>
        )・外貨預金の為替差損益(
        <Link href="/foreign-currency-deposit" className="underline">
          /foreign-currency-deposit
        </Link>
        )と同様の位置付け)。この画面で求めた「利子所得の金額の合計」は、他の総合課税所得と
        合算した後の金額として
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」へ手入力で反映すること。現地で源泉徴収された外国所得税額が
        ある場合は、
        <Link href="/foreign-tax-credit" className="underline">
          /foreign-tax-credit
        </Link>
        で外国税額控除を試算できる(同ページの自動集計値は国外源泉の配当等・株式等の譲渡益のみが
        対象のため、この利子所得分は手入力で上書きすること)。給与所得者で給与所得以外の所得
        (この利子所得を含む)の合計が年間20万円以下なら確定申告不要となる制度はあるが、他の理由で
        確定申告する場合はこの利子所得も含めて申告する必要がある。
      </p>
    </div>
  );
}
