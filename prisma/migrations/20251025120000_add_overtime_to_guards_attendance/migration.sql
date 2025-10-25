-- Migration: add_overtime_to_guards_attendance
-- Adds a nullable `overtime` BOOLEAN column with DEFAULT false to GuardsAttendance

-- PostgreSQL
ALTER TABLE "GuardsAttendance"
ADD COLUMN "overtime" BOOLEAN DEFAULT false;

-- Backfill existing rows where the column may be NULL (set to false)
UPDATE "GuardsAttendance"
SET "overtime" = false
WHERE "overtime" IS NULL;
