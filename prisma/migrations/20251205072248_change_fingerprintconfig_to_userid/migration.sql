/*
  Warnings:

  - You are about to drop the column `officeId` on the `FingerprintAgentConfig` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `FingerprintAgentConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `FingerprintAgentConfig` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FingerprintAgentConfig" DROP CONSTRAINT "FingerprintAgentConfig_officeId_fkey";

-- DropIndex
DROP INDEX "FingerprintAgentConfig_officeId_idx";

-- DropIndex
DROP INDEX "FingerprintAgentConfig_officeId_key";

-- AlterTable
ALTER TABLE "FingerprintAgentConfig" DROP COLUMN "officeId",
ADD COLUMN     "userId" UUID NOT NULL,
ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintAgentConfig_userId_key" ON "FingerprintAgentConfig"("userId");

-- CreateIndex
CREATE INDEX "FingerprintAgentConfig_userId_idx" ON "FingerprintAgentConfig"("userId");

-- AddForeignKey
ALTER TABLE "FingerprintAgentConfig" ADD CONSTRAINT "FingerprintAgentConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
