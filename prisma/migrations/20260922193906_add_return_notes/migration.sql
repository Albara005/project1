-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('SALES', 'PURCHASE');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalSourceType" ADD VALUE 'SALES_RETURN';
ALTER TYPE "JournalSourceType" ADD VALUE 'PURCHASE_RETURN';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "returnNoteId" TEXT;

-- CreateTable
CREATE TABLE "ReturnNote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ReturnType" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "supplierId" TEXT,
    "invoiceId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "reason" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnNoteItem" (
    "id" TEXT NOT NULL,
    "returnNoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "lineTotal" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ReturnNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnNote_number_key" ON "ReturnNote"("number");

-- CreateIndex
CREATE INDEX "ReturnNote_type_idx" ON "ReturnNote"("type");

-- CreateIndex
CREATE INDEX "ReturnNote_status_idx" ON "ReturnNote"("status");

-- CreateIndex
CREATE INDEX "ReturnNote_invoiceId_idx" ON "ReturnNote"("invoiceId");

-- CreateIndex
CREATE INDEX "ReturnNoteItem_returnNoteId_idx" ON "ReturnNoteItem"("returnNoteId");

-- AddForeignKey
ALTER TABLE "ReturnNote" ADD CONSTRAINT "ReturnNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnNote" ADD CONSTRAINT "ReturnNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnNote" ADD CONSTRAINT "ReturnNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnNote" ADD CONSTRAINT "ReturnNote_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnNoteItem" ADD CONSTRAINT "ReturnNoteItem_returnNoteId_fkey" FOREIGN KEY ("returnNoteId") REFERENCES "ReturnNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnNoteItem" ADD CONSTRAINT "ReturnNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_returnNoteId_fkey" FOREIGN KEY ("returnNoteId") REFERENCES "ReturnNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
