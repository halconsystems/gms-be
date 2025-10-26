-- Drop old overtime column
ALTER TABLE "GuardsAttendance" DROP COLUMN IF EXISTS "overtime";

-- Add new overtime column
ALTER TABLE "GuardsAttendance" ADD COLUMN "overtime" FLOAT;