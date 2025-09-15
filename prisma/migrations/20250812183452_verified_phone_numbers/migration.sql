-- CreateTable
CREATE TABLE "VerifiedPhone" (
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedPhone_pkey" PRIMARY KEY ("phone")
);
