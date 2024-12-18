/*
  Warnings:

  - A unique constraint covering the columns `[userId,subscriptionId]` on the table `Subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Subscriptions_subscriptionId_key";

-- DropIndex
DROP INDEX "Subscriptions_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Subscriptions_userId_subscriptionId_key" ON "Subscriptions"("userId", "subscriptionId");
