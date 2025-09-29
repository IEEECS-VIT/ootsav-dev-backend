-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F', 'Unspecified');

-- CreateEnum
CREATE TYPE "RSVP" AS ENUM ('accepted', 'declined', 'maybe', 'no_response', 'failed_delivery');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('Wedding', 'Birthday', 'Houseparty', 'Travel', 'Corporate', 'College', 'Other');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('English', 'Hindi');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('Public', 'Private');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('verified', 'unverified');

-- CreateEnum
CREATE TYPE "FoodPreference" AS ENUM ('veg', 'non_veg', 'anything');

-- CreateEnum
CREATE TYPE "InviteLinkStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "mobile_number" TEXT NOT NULL,
    "email" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'Unspecified',
    "profile_pic" TEXT,
    "preferred_language" "Language" NOT NULL DEFAULT 'English',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'unverified',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "location" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "invite_message" TEXT,
    "image" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'Private',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_date_time" TIMESTAMP(3) NOT NULL,
    "end_date_time" TIMESTAMP(3),
    "hostId" TEXT NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingEvent" (
    "id" TEXT NOT NULL,
    "bride_name" TEXT NOT NULL,
    "bride_details" TEXT,
    "bride_image" TEXT,
    "groom_name" TEXT NOT NULL,
    "groom_details" TEXT,
    "groom_image" TEXT,
    "hashtag" TEXT,

    CONSTRAINT "WeddingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayEvent" (
    "id" TEXT NOT NULL,
    "person_image" TEXT,
    "hashtag" TEXT,

    CONSTRAINT "BirthdayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousePartyEvent" (
    "id" TEXT NOT NULL,
    "cost" DOUBLE PRECISION DEFAULT 0.0,
    "rules" TEXT,
    "terms" TEXT,
    "tags" TEXT[],

    CONSTRAINT "HousePartyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelEvent" (
    "id" TEXT NOT NULL,
    "cost" DOUBLE PRECISION DEFAULT 0.0,
    "terms" TEXT,
    "itinerary_included" TEXT[],
    "itinerary_excluded" TEXT[],
    "rules" TEXT,
    "tags" TEXT[],

    CONSTRAINT "TravelEvent_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "SubEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "invite_message" TEXT,
    "image" TEXT,
    "start_date_time" TIMESTAMP(3) NOT NULL,
    "end_date_time" TIMESTAMP(3) NOT NULL,
    "event_id" TEXT,
    "guests" TEXT[],
    "messages" TEXT[],

    CONSTRAINT "SubEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "rsvp" "RSVP" NOT NULL DEFAULT 'no_response',
    "food" TEXT,
    "alcohol" BOOLEAN,
    "count" INTEGER NOT NULL DEFAULT 1,
    "pickup_date_time" TIMESTAMP(3),
    "pickup_location" TEXT,
    "dropoff_date_time" TIMESTAMP(3),
    "dropoff_location" TEXT,
    "user_id" TEXT,
    "event_id" TEXT NOT NULL,
    "group_id" TEXT,
    "name" TEXT,
    "phone_no" TEXT,
    "email" TEXT,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "GuestGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGuestGroup" (
    "event_id" TEXT NOT NULL,
    "guest_group_id" TEXT NOT NULL,
    "rsvp_lock_date" TIMESTAMP(3),
    "collect_food" BOOLEAN DEFAULT false,
    "collect_alcohol" BOOLEAN DEFAULT false,
    "global_additional_details" TEXT,
    "allow_additional_guests" BOOLEAN DEFAULT false,
    "collect_accommodation" BOOLEAN DEFAULT false,
    "accommodation_details" TEXT,
    "collect_transport" BOOLEAN DEFAULT false,
    "transport_details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGuestGroup_pkey" PRIMARY KEY ("event_id","guest_group_id")
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
    "alcohol_preference" BOOLEAN,
    "pickup_date_time" TIMESTAMP(3),
    "pickup_location" TEXT,
    "dropoff_date_time" TIMESTAMP(3),
    "dropoff_location" TEXT,
    "event_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedPhone" (
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedPhone_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "_CoHostEvents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CoHostEvents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_number_key" ON "User"("mobile_number");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_user_id_event_id_key" ON "Guest"("user_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "GuestGroupUsers_guest_group_id_user_id_key" ON "GuestGroupUsers"("guest_group_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_invite_link_key" ON "InviteLink"("invite_link");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_phone_no_event_id_key" ON "Invite"("phone_no", "event_id");

-- CreateIndex
CREATE INDEX "_CoHostEvents_B_index" ON "_CoHostEvents"("B");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingEvent" ADD CONSTRAINT "WeddingEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayEvent" ADD CONSTRAINT "BirthdayEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousePartyEvent" ADD CONSTRAINT "HousePartyEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelEvent" ADD CONSTRAINT "TravelEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateEvent" ADD CONSTRAINT "CorporateEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeEvent" ADD CONSTRAINT "CollegeEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherEvent" ADD CONSTRAINT "OtherEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "GuestGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestGroup" ADD CONSTRAINT "GuestGroup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGuestGroup" ADD CONSTRAINT "EventGuestGroup_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGuestGroup" ADD CONSTRAINT "EventGuestGroup_guest_group_id_fkey" FOREIGN KEY ("guest_group_id") REFERENCES "GuestGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CoHostEvents" ADD CONSTRAINT "_CoHostEvents_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CoHostEvents" ADD CONSTRAINT "_CoHostEvents_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
