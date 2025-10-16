/*
  Warnings:

  - Added the required column `addressLine1` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phoneNumber1` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `province` to the `Organization` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "addressLine1" TEXT NOT NULL,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "phoneNumber1" TEXT NOT NULL,
ADD COLUMN     "phoneNumber2" TEXT,
ADD COLUMN     "province" TEXT NOT NULL;
