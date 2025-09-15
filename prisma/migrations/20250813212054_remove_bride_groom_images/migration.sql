/*
  Warnings:

  - You are about to drop the column `bride_groom_images` on the `WeddingEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WeddingEvent" DROP COLUMN "bride_groom_images",
ADD COLUMN     "bride_image" TEXT,
ADD COLUMN     "groom_image" TEXT;
