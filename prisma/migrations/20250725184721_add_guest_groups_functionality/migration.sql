-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('Public', 'Private');

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_event_id_fkey";

-- DropForeignKey
ALTER TABLE "SubEvent" DROP CONSTRAINT "SubEvent_event_id_fkey";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "bannerImage" TEXT,
ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'Private';

-- CreateTable
CREATE TABLE "WeddingEvent" (
    "id" TEXT NOT NULL,
    "bride_name" TEXT NOT NULL,
    "bride_details" TEXT,
    "groom_name" TEXT NOT NULL,
    "groom_details" TEXT,
    "bride_groom_images" TEXT[],
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
CREATE TABLE "AnniversaryEvent" (
    "id" TEXT NOT NULL,
    "couple_names" TEXT NOT NULL,
    "anniversary_year" INTEGER,
    "couple_image" TEXT,
    "hashtag" TEXT,

    CONSTRAINT "AnniversaryEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeddingEvent" ADD CONSTRAINT "WeddingEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayEvent" ADD CONSTRAINT "BirthdayEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousePartyEvent" ADD CONSTRAINT "HousePartyEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelEvent" ADD CONSTRAINT "TravelEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnniversaryEvent" ADD CONSTRAINT "AnniversaryEvent_id_fkey" FOREIGN KEY ("id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
