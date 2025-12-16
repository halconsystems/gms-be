-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "CaptureRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "AgentRegistration" (
    "id" UUID NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" UUID,
    "officeId" UUID,
    "status" "AgentStatus" NOT NULL,
    "version" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AgentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptureRequest" (
    "id" UUID NOT NULL,
    "requestId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" "CaptureRequestStatus" NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistration_agentId_key" ON "AgentRegistration"("agentId");

-- CreateIndex
CREATE INDEX "AgentRegistration_agentId_idx" ON "AgentRegistration"("agentId");

-- CreateIndex
CREATE INDEX "AgentRegistration_userId_idx" ON "AgentRegistration"("userId");

-- CreateIndex
CREATE INDEX "AgentRegistration_status_idx" ON "AgentRegistration"("status");

-- CreateIndex
CREATE INDEX "AgentRegistration_lastSeenAt_idx" ON "AgentRegistration"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureRequest_requestId_key" ON "CaptureRequest"("requestId");

-- CreateIndex
CREATE INDEX "CaptureRequest_requestId_idx" ON "CaptureRequest"("requestId");

-- CreateIndex
CREATE INDEX "CaptureRequest_agentId_status_idx" ON "CaptureRequest"("agentId", "status");

-- CreateIndex
CREATE INDEX "CaptureRequest_userId_idx" ON "CaptureRequest"("userId");

-- CreateIndex
CREATE INDEX "CaptureRequest_status_createdAt_idx" ON "CaptureRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CaptureRequest_timeoutAt_idx" ON "CaptureRequest"("timeoutAt");

-- AddForeignKey
ALTER TABLE "AgentRegistration" ADD CONSTRAINT "AgentRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRegistration" ADD CONSTRAINT "AgentRegistration_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureRequest" ADD CONSTRAINT "CaptureRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistration"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureRequest" ADD CONSTRAINT "CaptureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
