/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.brokerAnnualReport`を呼んでいた
 * 処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と
 * 完全に一致させる。
 */
import type { BrokerAnnualReport, InvestmentAccountType } from "@prisma/client";
import { prisma } from "../db";

export interface BrokerAnnualReportUpsertInput {
  taxYearId: number;
  broker: string;
  accountType: InvestmentAccountType;
  proceedsJpy: string;
  acquisitionCostJpy: string;
  dividendJpy: string;
}

export interface BrokerAnnualReportRepository {
  findByTaxYearId(taxYearId: number): Promise<BrokerAnnualReport[]>;
  upsert(input: BrokerAnnualReportUpsertInput): Promise<void>;
  delete(id: number): Promise<void>;
  upsertMany(inputs: BrokerAnnualReportUpsertInput[]): Promise<void>;
}

export function createPrismaBrokerAnnualReportRepository(): BrokerAnnualReportRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<BrokerAnnualReport[]> {
      return prisma.brokerAnnualReport.findMany({
        where: { taxYearId },
        orderBy: [{ broker: "asc" }, { accountType: "asc" }],
      });
    },

    async upsert({
      taxYearId,
      broker,
      accountType,
      proceedsJpy,
      acquisitionCostJpy,
      dividendJpy,
    }): Promise<void> {
      await prisma.brokerAnnualReport.upsert({
        where: {
          taxYearId_broker_accountType: { taxYearId, broker, accountType },
        },
        create: {
          taxYearId,
          broker,
          accountType,
          proceedsJpy,
          acquisitionCostJpy,
          dividendJpy,
        },
        update: { proceedsJpy, acquisitionCostJpy, dividendJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.brokerAnnualReport.delete({ where: { id } });
    },

    async upsertMany(inputs): Promise<void> {
      await prisma.$transaction(
        inputs.map((input) =>
          prisma.brokerAnnualReport.upsert({
            where: {
              taxYearId_broker_accountType: {
                taxYearId: input.taxYearId,
                broker: input.broker,
                accountType: input.accountType,
              },
            },
            create: {
              taxYearId: input.taxYearId,
              broker: input.broker,
              accountType: input.accountType,
              proceedsJpy: input.proceedsJpy,
              acquisitionCostJpy: input.acquisitionCostJpy,
              dividendJpy: input.dividendJpy,
            },
            update: {
              proceedsJpy: input.proceedsJpy,
              acquisitionCostJpy: input.acquisitionCostJpy,
              dividendJpy: input.dividendJpy,
            },
          }),
        ),
      );
    },
  };
}
