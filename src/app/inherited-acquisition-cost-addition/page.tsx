import Link from "next/link";
import { InheritedAcquisitionCostAdditionForm } from "./InheritedAcquisitionCostAdditionForm";

export default function InheritedAcquisitionCostAdditionPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          相続財産を譲渡した場合の取得費加算の特例の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          相続又は遺贈により取得した株式等・投資信託等を、相続開始のあった日の翌日から
          その財産に係る相続税の申告期限の翌日以後3年を経過する日までに譲渡した場合、
          国税庁タックスアンサーNo.3267「相続財産を譲渡した場合の取得費の特例」
          (租税特別措置法39条)に基づき、相続税額のうち一定の金額を譲渡所得の取得費に
          加算できる。相続税額・相続税の課税価格と、譲渡した財産ごとの相続税評価額・
          譲渡益を入力すると、財産ごとの取得費加算額とその合計を試算できる。暗号資産・
          投資の集計とは独立した単体の試算画面のため、特定の年分の取引データには
          依存しない。
        </p>
      </header>

      <InheritedAcquisitionCostAdditionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        この特例は譲渡所得にのみ適用があり、株式等の譲渡による事業所得・雑所得には
        適用できない。本ツールが扱う上場株式等・一般株式等・投資信託の譲渡損益(
        <Link href="/import" className="underline">
          /import
        </Link>
        で登録する取引)は譲渡所得に区分されるため対象になる。この画面は他の所得控除
        試算画面と異なり試算結果を直接DBへ登録する機能は持たない(取得費への加算は
        個々の譲渡取引の取得費そのものを書き換えるものであり、登録済みの取引データを
        本機能から直接更新する仕組みは無いため)。試算結果(取得費加算額)は、該当する
        譲渡取引の取得費入力欄へユーザー自身が加算する前提とする。適用期限(相続開始の
        あった日の翌日から相続税の申告期限の翌日以後3年を経過する日まで)内かどうかは
        実際の日付計算を行わないため、財産ごとにユーザー自身で確認すること。
      </p>
    </div>
  );
}
