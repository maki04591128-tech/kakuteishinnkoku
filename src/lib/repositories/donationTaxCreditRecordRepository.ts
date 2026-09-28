/**
 * フェーズ1(リポジトリパターン導入): `src/lib/donationTaxCredit.ts`が
 * 直接`prisma.donationTaxCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { DonationTaxCreditRecord } from "@prisma/client";
import { prisma } from "../db";

export interface DonationTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<DonationTaxCreditRecord | null>;
}

export function createPrismaDonationTaxCreditRecordRepository(): DonationTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<DonationTaxCreditRecord | null> {
      return prisma.donationTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },
  };
}
