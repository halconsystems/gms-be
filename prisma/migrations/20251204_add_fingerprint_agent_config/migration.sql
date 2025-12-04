-- CreateTable FingerprintAgentConfig
CREATE TABLE "FingerprintAgentConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "officeId" UUID NOT NULL,
    "agentIp" TEXT NOT NULL,
    "agentPort" INTEGER NOT NULL DEFAULT 8765,
    "configuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FingerprintAgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintAgentConfig_officeId_key" ON "FingerprintAgentConfig"("officeId");

-- CreateIndex
CREATE INDEX "FingerprintAgentConfig_officeId_idx" ON "FingerprintAgentConfig"("officeId");

-- AddForeignKey
ALTER TABLE "FingerprintAgentConfig" ADD CONSTRAINT "FingerprintAgentConfig_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;
