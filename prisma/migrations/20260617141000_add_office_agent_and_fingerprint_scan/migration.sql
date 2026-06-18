-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "OfficeAgent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "agentSecretHash" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FingerprintScan" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT,
    "fingerName" TEXT,
    "quality" INTEGER,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FingerprintScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficeAgent_officeId_key" ON "OfficeAgent"("officeId");

-- CreateIndex
CREATE INDEX "OfficeAgent_status_idx" ON "OfficeAgent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeAgent_organizationId_officeId_key" ON "OfficeAgent"("organizationId", "officeId");

-- CreateIndex
CREATE INDEX "FingerprintScan_organizationId_officeId_idx" ON "FingerprintScan"("organizationId", "officeId");

-- CreateIndex
CREATE INDEX "FingerprintScan_userId_idx" ON "FingerprintScan"("userId");

-- AddForeignKey
ALTER TABLE "OfficeAgent" ADD CONSTRAINT "OfficeAgent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeAgent" ADD CONSTRAINT "OfficeAgent_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintScan" ADD CONSTRAINT "FingerprintScan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintScan" ADD CONSTRAINT "FingerprintScan_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintScan" ADD CONSTRAINT "FingerprintScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
