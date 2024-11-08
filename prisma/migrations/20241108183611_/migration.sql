-- CreateTable
CREATE TABLE "Subscriptions" (
    "id" UUID NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "subscriptionStatus" TEXT NOT NULL,

    CONSTRAINT "Subscriptions_pkey" PRIMARY KEY ("id")
);
