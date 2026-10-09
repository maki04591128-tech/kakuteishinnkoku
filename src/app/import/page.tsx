import { Suspense } from "react";
import { ImportPageContent, ImportPageSkeleton } from "./ImportPageContent";

// フェーズ7-4・3回目(ステップ(3))。42個のServer Action importを抱える最大のページ
// のため1〜2回目でデータ取得層(`@/lib/importPageData`)を切り出し済み。このファイルは
// 他の移行済みページと同じく`<Suspense>`境界を提供するだけの薄いServer Componentで、
// 画面本体(2900行のJSX)は`"use client"`化した`ImportPageContent`に移した。
export default function ImportPage() {
  return (
    <Suspense fallback={<ImportPageSkeleton />}>
      <ImportPageContent />
    </Suspense>
  );
}
