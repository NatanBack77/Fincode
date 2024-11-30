-- AlterTable
ALTER TABLE "Subscriptions" ALTER COLUMN "subscriptionEnd" DROP NOT NULL,
ALTER COLUMN "subscriptionEnd" DROP DEFAULT;
