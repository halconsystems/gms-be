/*
  Warnings:

  - You are about to drop the column `agentId` on the `FingerprintAgentConfig` table. All the data in the column will be lost.
  - You are about to drop the `AgentRegistration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CaptureRequest` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `agentIp` on table `FingerprintAgentConfig` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "AgentRegistration" DROP CONSTRAINT "AgentRegistration_officeId_fkey";

-- DropForeignKey
ALTER TABLE "AgentRegistration" DROP CONSTRAINT "AgentRegistration_userId_fkey";

-- DropForeignKey
ALTER TABLE "CaptureRequest" DROP CONSTRAINT "CaptureRequest_agentId_fkey";

-- DropForeignKey
ALTER TABLE "CaptureRequest" DROP CONSTRAINT "CaptureRequest_userId_fkey";

-- DropIndex
DROP INDEX "FingerprintAgentConfig_agentId_idx";

-- DropIndex
DROP INDEX "FingerprintAgentConfig_agentId_key";

-- AlterTable
ALTER TABLE "FingerprintAgentConfig" DROP COLUMN "agentId",
ALTER COLUMN "agentIp" SET NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "subFeaturesData" JSONB DEFAULT '{}';

-- DropTable
DROP TABLE "AgentRegistration";

-- DropTable
DROP TABLE "CaptureRequest";

-- DropEnum
DROP TYPE "AgentStatus";

-- DropEnum
DROP TYPE "CaptureRequestStatus";
