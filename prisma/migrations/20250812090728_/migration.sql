/*
  Warnings:

  - You are about to drop the column `count` on the `GuestGroup` table. All the data in the column will be lost.
  - You are about to drop the column `members` on the `GuestGroup` table. All the data in the column will be lost.
  - Added the required column `createdBy` to the `GuestGroup` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('verified', 'unverified');

-- CreateEnum
CREATE TYPE "FoodPreference" AS ENUM ('veg', 'non_veg', 'anything');

-- CreateEnum
CREATE TYPE "AlcoholPreference" AS ENUM ('wine', 'gin', 'vodka', 'beer', 'none');

-- CreateEnum
CREATE TYPE "InviteLinkStatus" AS ENUM ('active', 'inactive');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'Corporate';
ALTER TYPE "EventType" ADD VALUE 'College';
ALTER TYPE "EventType" ADD VALUE 'Other';

-- AlterEnum
ALTER TYPE "RSVP" ADD VALUE 'failed_delivery';

-- AlterTable
ALTER TABLE "GuestGroup" DROP COLUMN "count",
DROP COLUMN "members",
ADD COLUMN     "createdBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "verification_status" "VerificationStatus" NOT NULL DEFAULT 'unverified';

-- CreateTable
CREATE TABLE "CorporateEvent" (
    "id" TEXT NOT NULL,
    "event_details" TEXT NOT NULL,
    "terms" TEXT,

    CONSTRAINT "CorporateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollegeEvent" (
    "id" TEXT NOT NULL,
    "event_details" TEXT NOT NULL,
    "terms" TEXT,

    CONSTRAINT "CollegeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherEvent" (
    "id" TEXT NOT NULL,
    "event_details" TEXT NOT NULL,
    "terms" TEXT,

    CONSTRAINT "OtherEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestGroupUsers" (
    "id" TEXT NOT NULL,
    "guest_group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_by" TEXT NOT NULL,

    CONSTRAINT "GuestGroupUsers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "invite_link" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "status" "InviteLinkStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone_no" TEXT NOT NULL,
    "rsvp_status" "RSVP" NOT NULL DEFAULT 'no_response',
    "additional_guest_count" INTEGER NOT NULL DEFAULT 0,
    "food_preference" "FoodPreference",
    "alcohol_preference" "AlcoholPreference",
    "accommodation_dates" TEXT[],
    "event_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestGroupUsers_guest_group_id_user_id_key" ON "GuestGroupUsers"("guest_group_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_invite_link_key" ON "InviteLink"("invite_link");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_phone_no_event_id_key" ON "Invite"("phone_no", "event_id");

-- AddForeignKey
ALTER TABLE "CorporateEvent" ADD CONSTRAINT "CorporateEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeEvent" ADD CONSTRAINT "CollegeEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherEvent" ADD CONSTRAINT "OtherEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestGroup" ADD CONSTRAINT "GuestGroup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestGroupUsers" ADD CONSTRAINT "GuestGroupUsers_guest_group_id_fkey" FOREIGN KEY ("guest_group_id") REFERENCES "GuestGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestGroupUsers" ADD CONSTRAINT "GuestGroupUsers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestGroupUsers" ADD CONSTRAINT "GuestGroupUsers_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "GuestGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "GuestGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
