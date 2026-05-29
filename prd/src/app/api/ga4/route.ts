import { PrismaClient } from "@prisma/client";
import { createReportSourceHandler } from "@/lib/report/source-api";

const prisma = new PrismaClient();

export const POST = createReportSourceHandler(prisma, "ga4");
