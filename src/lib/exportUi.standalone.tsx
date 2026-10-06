"use client";

// スタンドアロン版ビルド用の`@/lib/exportUi`差し替え実装(next.config.tsのresolveAlias経由)。
// `/api/export`(Route Handler)はスタンドアロン版のビルド対象から除外されている
// (`scripts/build-standalone.mjs`の退避対象。Requestに応じて動的にレスポンスを生成する
// 以上`output: "export"`と併用できないため)。代わりにブラウザ上で直接
// `buildDraftCsvExport`(5-1-3bの切り替え機構により、依存先のリポジトリは全て
// クライアント実装に差し替わる)を実行し、生成したCSVをBlobとしてダウンロードさせる。

import { useState } from "react";
import { buildDraftCsvExport } from "@/lib/etax/exportDraftCsv";

export function DraftCsvExportLink({ year }: { year: number }) {
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    let result;
    try {
      result = await buildDraftCsvExport(year);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSVの生成に失敗しました");
      return;
    }
    if (!result) {
      setError("指定された年分のデータがありません");
      return;
    }

    const blob = new Blob([result.content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        申告書作成コーナー用の下書きCSVをダウンロード
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
