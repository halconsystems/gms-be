/*
  Warnings:

  - Added the required column `supervisorEmployeeId` to the `AssignedSupervisor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."AssignedSupervisor" ADD COLUMN     "supervisorEmployeeId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."AssignedSupervisor" ADD CONSTRAINT "AssignedSupervisor_supervisorEmployeeId_fkey" FOREIGN KEY ("supervisorEmployeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
