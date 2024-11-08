/*
  Warnings:

  - Added the required column `stripeProductId` to the `Prices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Prices" ADD COLUMN     "stripeProductId" TEXT NOT NULL;
