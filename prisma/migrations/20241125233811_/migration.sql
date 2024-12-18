/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Subscriptions_userId_key" ON "Subscriptions"("userId");
