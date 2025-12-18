-- AlterTable
ALTER TABLE "LocationPayRollDuration" ADD COLUMN     "finalLockedAt" TIMESTAMP(3),
ADD COLUMN     "isFinalLocked" BOOLEAN NOT NULL DEFAULT false;
