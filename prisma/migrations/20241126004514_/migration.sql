/*
  Warnings:

  - A unique constraint covering the columns `[subscriptionId]` on the table `Subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Subscriptions_subscriptionId_key" ON "Subscriptions"("subscriptionId");
