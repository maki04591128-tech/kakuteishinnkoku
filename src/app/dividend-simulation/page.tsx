import { Suspense } from "react";
import {
  DividendSimulationPageContent,
  DividendSimulationPageSkeleton,
} from "./DividendSimulationPageContent";

// フェーズ7-3継続(7-2のPoCで確立したパターンの適用)。`searchParams` propを使う
// 非同期Server Componentは`output: "export"`の静的書き出しと非対応のため、実際の
// 画面本体は`"use client"`化した`DividendSimulationPageContent`に移し、
// `useSearchParams()`で`year`を読み取る構成にした。`useSearchParams()`を呼ぶ
// Client Componentは`<Suspense>`境界で囲む必要があり、このファイル自体はその
// 境界を提供するだけの薄いServer Componentとして残す。
export default function DividendSimulationPage() {
  return (
    <Suspense fallback={<DividendSimulationPageSkeleton />}>
      <DividendSimulationPageContent />
    </Suspense>
  );
}
