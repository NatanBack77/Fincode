/*
  Warnings:

  - A unique constraint covering the columns `[costumerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_costumerId_key" ON "User"("costumerId");
