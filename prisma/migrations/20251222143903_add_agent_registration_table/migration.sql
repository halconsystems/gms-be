-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateTable
CREATE TABLE "AgentRegistration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "agentIp" TEXT NOT NULL,
    "agentPort" INTEGER NOT NULL DEFAULT 9001,
    "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistration_userId_key" ON "AgentRegistration"("userId");

-- CreateIndex
CREATE INDEX "AgentRegistration_userId_idx" ON "AgentRegistration"("userId");

-- CreateIndex
CREATE INDEX "AgentRegistration_status_idx" ON "AgentRegistration"("status");

-- AddForeignKey
ALTER TABLE "AgentRegistration" ADD CONSTRAINT "AgentRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
