// `@/lib/unrealizedGainPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/unrealizedGainPageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出し、
// 呼び出し元(`UnrealizedGainPageContent.tsx`)はビルドターゲットの切り替え
// (next.config.tsのresolveAlias)を経由しないこのファイルから直接importする。
import type { UnrealizedAssetType } from "@/lib/unrealizedGain";

export interface UnrealizedGainPageDataHolding {
  assetType: UnrealizedAssetType;
  symbol: string;
  quantity: string;
  costBasisJpy: string;
  defaultCurrentPriceJpy: string;
}

export interface UnrealizedGainPageData {
  year: number;
  availableYears: number[];
  holdings: UnrealizedGainPageDataHolding[];
}
