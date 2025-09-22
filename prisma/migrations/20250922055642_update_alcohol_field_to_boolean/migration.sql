/*
  Warnings:

  - The `alcohol` column on the `Guest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `alcohol_preference` column on the `Invite` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Guest" DROP COLUMN "alcohol",
ADD COLUMN     "alcohol" BOOLEAN;

-- AlterTable
ALTER TABLE "Invite" DROP COLUMN "alcohol_preference",
ADD COLUMN     "alcohol_preference" BOOLEAN;

-- DropEnum
DROP TYPE "AlcoholPreference";
