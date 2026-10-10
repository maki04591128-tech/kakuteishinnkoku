"use client";

import { useEffect, useState, useTransition } from "react";

export interface AsyncPageDataState<T> {
  data: T | null;
  error: Error | null;
  isPending: boolean;
}

/**
 * 各ページの`PageContent.tsx`("use client")がclientDb経由のデータ取得
 * (`get<Page>PageData`等)を行う際に使う共通hook。
 *
 * スタンドアロン版では、OPFS/Web Worker未対応の古いWebViewで`openClientDb`
 * (`src/lib/clientDb/sqlite.browser.ts`)が`Error`をthrowする(フェーズ6-12)。
 * これまでこの例外を捕捉する処理が無く、`data`が`null`のまま
 * 「読み込み中…」のスケルトン表示で画面が停止して見える問題があった(6-12の
 * 実装内容・次回候補を参照)。この hook は取得処理を`try/catch`し、
 * 失敗時は`error`に格納することで呼び出し元がエラー表示できるようにする。
 */
export function useAsyncPageData<T>(
  fetchData: () => Promise<T>,
  deps: readonly unknown[],
): AsyncPageDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await fetchData();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    });
    // fetchDataは呼び出し元で都度新しいクロージャとして生成されるため、
    // 依存配列は呼び出し元が明示的に渡す`deps`のみを使う(既存の各
    // PageContent.tsxが`useEffect(..., [yearParam])`等としていたのと同じ意図)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, isPending };
}
