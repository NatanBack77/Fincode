/*
  Warnings:

  - The `subscriptionEnd` column on the `Subscriptions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Subscriptions" DROP COLUMN "subscriptionEnd",
ADD COLUMN     "subscriptionEnd" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;
