/*
  Warnings:

  - The `hasActiveSubscription` column on the `Subscriptions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INCOMPLETE', 'CANCELlED');

-- AlterTable
ALTER TABLE "Subscriptions" DROP COLUMN "hasActiveSubscription",
ADD COLUMN     "hasActiveSubscription" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE';
