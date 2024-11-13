/*
  Warnings:

  - Added the required column `pricesId` to the `Subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Subscriptions" ADD COLUMN     "pricesId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "Subscriptions" ADD CONSTRAINT "Subscriptions_pricesId_fkey" FOREIGN KEY ("pricesId") REFERENCES "Prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
