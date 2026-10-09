import { Suspense } from "react";
import { HomePageContent, HomePageSkeleton } from "./HomePageContent";
import { LogoutButton } from "@/lib/authUi";

// フェーズ7-3継続(12回目。7-2のPoCで確立したパターンの適用)。`searchParams` propを使う
// 非同期Server Componentは`output: "export"`の静的書き出しと非対応のため、実際の
// 画面本体は`"use client"`化した`HomePageContent`に移し、`useSearchParams()`で
// `year`を読み取る構成にした。`useSearchParams()`を呼ぶClient Componentは
// `<Suspense>`境界で囲む必要があり、このファイル自体はその境界を提供するだけの
// 薄いServer Componentとして残す。
// `LogoutButton`(`@/lib/authUi`)は内部で`next/headers`に依存する`@/lib/auth/session`を
// importしているため、`"use client"`な`HomePageContent`内から直接importするとNext.jsの
// ビルドが失敗する(next/headersはServer Componentでのみ使用可能)。Server Component
// (このファイル)側でレンダリングした結果をpropとして渡す、Next.js公式の
// 「Server ComponentをClient Componentの子として渡す」パターンで回避する。
export default function Home() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent logoutButton={<LogoutButton />} />
    </Suspense>
  );
}
