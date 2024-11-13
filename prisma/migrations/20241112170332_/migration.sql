/*
  Warnings:

  - Changed the type of `hasActiveSubscription` on the `Subscriptions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Subscriptions" DROP COLUMN "hasActiveSubscription",
ADD COLUMN     "hasActiveSubscription" BOOLEAN NOT NULL,
ALTER COLUMN "subscriptionId" SET DATA TYPE TEXT;
