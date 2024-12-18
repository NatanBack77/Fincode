/*
  Warnings:

  - You are about to drop the column `subscriptionStatus` on the `Subscriptions` table. All the data in the column will be lost.
  - Added the required column `hasActiveSubscription` to the `Subscriptions` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `subscriptionId` on the `Subscriptions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Subscriptions" DROP COLUMN "subscriptionStatus",
ADD COLUMN     "hasActiveSubscription" TEXT NOT NULL,
DROP COLUMN "subscriptionId",
ADD COLUMN     "subscriptionId" BOOLEAN NOT NULL;
