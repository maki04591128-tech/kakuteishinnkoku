// 自宅サーバー版のデフォルト実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`exportUi.standalone.tsx`に差し替えられる
// (`@/lib/authUi`と同種のパターン)。`/api/export`(Route Handler)はRequestに応じて
// 動的にレスポンスを生成するため`output: "export"`と併用できず、スタンドアロン版では
// このRoute Handler自体がビルド対象から除外される(`scripts/build-standalone.mjs`)。
// 代わりにスタンドアロン版では、ブラウザ上で直接`buildDraftCsvExport`を実行して
// Blobダウンロードさせる(README「現在の最優先事項」フェーズ5-1-3cの決定)。

export function DraftCsvExportLink({ year }: { year: number }) {
  return (
    <a
      href={`/api/export?year=${year}`}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
    >
      申告書作成コーナー用の下書きCSVをダウンロード
    </a>
  );
}
