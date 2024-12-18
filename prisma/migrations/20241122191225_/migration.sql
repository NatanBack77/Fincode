-- CreateTable
CREATE TABLE "PaymentMentMethod" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "paymentMethodId" TEXT NOT NULL,

    CONSTRAINT "PaymentMentMethod_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaymentMentMethod" ADD CONSTRAINT "PaymentMentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
