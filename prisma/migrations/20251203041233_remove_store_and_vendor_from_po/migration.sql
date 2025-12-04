/*
  Warnings:

  - You are about to drop the column `storeId` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `vendorId` on the `PurchaseOrder` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_storeId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_vendorId_fkey";

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "storeId",
DROP COLUMN "vendorId";
