-- CreateEnum
CREATE TYPE "CashFlowCategory" AS ENUM ('OPERATING', 'INVESTING', 'FINANCING', 'CASH');

-- AlterTable
ALTER TABLE "ChartOfAccount" ADD COLUMN     "cashFlowCategory" "CashFlowCategory";
