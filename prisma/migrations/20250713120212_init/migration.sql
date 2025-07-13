/*
  Warnings:

  - You are about to drop the column `date_time` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `date_time` on the `SubEvent` table. All the data in the column will be lost.
  - The `preferred_language` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[user_id,event_id]` on the table `Guest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `end_date_time` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date_time` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_date_time` to the `SubEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date_time` to the `SubEvent` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Language" AS ENUM ('English', 'Hindi');

-- DropIndex
DROP INDEX "Event_image_key";

-- DropIndex
DROP INDEX "SubEvent_image_key";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "date_time",
ADD COLUMN     "end_date_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "start_date_time" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "image" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubEvent" DROP COLUMN "date_time",
ADD COLUMN     "end_date_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "start_date_time" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "image" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "profile_pic" DROP NOT NULL,
DROP COLUMN "preferred_language",
ADD COLUMN     "preferred_language" "Language" NOT NULL DEFAULT 'English';

-- CreateIndex
CREATE UNIQUE INDEX "Guest_user_id_event_id_key" ON "Guest"("user_id", "event_id");
