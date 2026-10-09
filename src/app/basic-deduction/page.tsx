import { Suspense } from "react";
import { BasicDeductionPageContent, BasicDeductionPageSkeleton } from "./BasicDeductionPageContent";

// フェーズ7-2(searchParams問題解消のPoC)。`searchParams` propを使う非同期
// Server Componentは`output: "export"`の静的書き出しと非対応のため、実際の
// 画面本体は`"use client"`化した`BasicDeductionPageContent`に移し、
// `useSearchParams()`で`year`を読み取る構成にした(フェーズ7-1の決定)。
// `useSearchParams()`を呼ぶClient Componentは`<Suspense>`境界で囲む必要があり
// (Next.js公式ドキュメントの推奨。囲わないと静的ビルドが失敗する)、このファイル
// 自体はその境界を提供するだけの薄いServer Componentとして残す。
export default function BasicDeductionPage() {
  return (
    <Suspense fallback={<BasicDeductionPageSkeleton />}>
      <BasicDeductionPageContent />
    </Suspense>
  );
}
