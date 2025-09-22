/*
  Warnings:

  - You are about to drop the column `accommodation` on the `Guest` table. All the data in the column will be lost.
  - You are about to drop the column `accommodation_dates` on the `Invite` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Guest" DROP COLUMN "accommodation",
ADD COLUMN     "dropoff_date_time" TIMESTAMP(3),
ADD COLUMN     "dropoff_location" TEXT,
ADD COLUMN     "pickup_date_time" TIMESTAMP(3),
ADD COLUMN     "pickup_location" TEXT;

-- AlterTable
ALTER TABLE "Invite" DROP COLUMN "accommodation_dates",
ADD COLUMN     "dropoff_date_time" TIMESTAMP(3),
ADD COLUMN     "dropoff_location" TEXT,
ADD COLUMN     "pickup_date_time" TIMESTAMP(3),
ADD COLUMN     "pickup_location" TEXT;
