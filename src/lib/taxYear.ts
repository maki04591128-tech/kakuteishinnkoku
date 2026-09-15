import { prisma } from "./db";

export async function getOrCreateTaxYear(year: number) {
  return prisma.taxYear.upsert({
    where: { year },
    create: { year },
    update: {},
  });
}

export async function listTaxYears(): Promise<number[]> {
  const years = await prisma.taxYear.findMany({
    orderBy: { year: "desc" },
    select: { year: true },
  });
  return years.map((y) => y.year);
}
