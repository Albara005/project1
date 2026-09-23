-- CreateEnum
CREATE TYPE "EInvoiceType" AS ENUM ('STANDARD', 'SIMPLIFIED');

-- CreateEnum
CREATE TYPE "EInvoiceStatus" AS ENUM ('GENERATED', 'SIGNED', 'SUBMITTED', 'REPORTED', 'CLEARED', 'ACCEPTED_WITH_WARNINGS', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "EInvoice" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "icv" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "type" "EInvoiceType" NOT NULL,
    "status" "EInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "xml" TEXT NOT NULL,
    "signedXml" TEXT,
    "qrCode" TEXT,
    "signature" TEXT,
    "submittedAt" TIMESTAMP(3),
    "responseStatus" TEXT,
    "responseBody" TEXT,
    "warnings" TEXT,
    "errors" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceCredential" (
    "id" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "privateKeyPem" TEXT NOT NULL,
    "publicKeyPem" TEXT NOT NULL,
    "csrPem" TEXT NOT NULL,
    "complianceCsid" TEXT,
    "complianceSecret" TEXT,
    "productionCsid" TEXT,
    "productionSecret" TEXT,
    "certificatePem" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoiceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_invoiceId_key" ON "EInvoice"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_uuid_key" ON "EInvoice"("uuid");

-- CreateIndex
CREATE INDEX "EInvoice_status_idx" ON "EInvoice"("status");

-- CreateIndex
CREATE INDEX "EInvoice_icv_idx" ON "EInvoice"("icv");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceCredential_deviceName_key" ON "EInvoiceCredential"("deviceName");

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
