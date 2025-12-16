/*
  Warnings:

  - A unique constraint covering the columns `[agentId]` on the table `FingerprintAgentConfig` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "FingerprintAgentConfig" ADD COLUMN     "agentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintAgentConfig_agentId_key" ON "FingerprintAgentConfig"("agentId");

-- CreateIndex
CREATE INDEX "FingerprintAgentConfig_agentId_idx" ON "FingerprintAgentConfig"("agentId");
