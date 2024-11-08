/*
  Warnings:

  - You are about to drop the column `currency` on the `Products` table. All the data in the column will be lost.
  - You are about to drop the column `unit_amout` on the `Products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Products" DROP COLUMN "currency",
DROP COLUMN "unit_amout";
