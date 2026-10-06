/**
 * フェーズ5-1-3b: `BrokerAnnualReportRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientBrokerAnnualReportRepository`。
 * `brokerAnnualReportRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで`@/lib/repositories/defaultBrokerAnnualReportRepository`を
 * `defaultBrokerAnnualReportRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type {
  BrokerAnnualReportRepository,
  BrokerAnnualReportUpsertInput,
} from "./brokerAnnualReportRepository";
import type { BrokerAnnualReport } from "@prisma/client";

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
    }: BrokerAnnualReportUpsertInput): Promise<void> {
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

    async upsertMany(inputs: BrokerAnnualReportUpsertInput[]): Promise<void> {
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
