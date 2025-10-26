-- AlterTable
ALTER TABLE "GuardsAttendance" DROP COLUMN "overtime",
ADD COLUMN "overtime" BOOLEAN NOT NULL DEFAULT false;