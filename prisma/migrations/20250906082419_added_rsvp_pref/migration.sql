/*
  Warnings:

  - A unique constraint covering the columns `[user_id,event_id]` on the table `Guest` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "RsvpPreferences" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "group_id" TEXT,
    "rsvp_lock_date" TIMESTAMP(3) NOT NULL,
    "collect_attendance" BOOLEAN NOT NULL DEFAULT true,
    "collect_guest_count" BOOLEAN NOT NULL DEFAULT true,
    "collect_food" BOOLEAN NOT NULL DEFAULT false,
    "collect_alcohol" BOOLEAN NOT NULL DEFAULT false,
    "collect_accommodation" BOOLEAN NOT NULL DEFAULT false,
    "accommodation_details" TEXT,
    "collect_transport" BOOLEAN NOT NULL DEFAULT false,
    "transport_details" TEXT,
    "additional_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RsvpPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RsvpPreferences_event_id_idx" ON "RsvpPreferences"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "RsvpPreferences_event_id_group_id_key" ON "RsvpPreferences"("event_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_user_id_event_id_key" ON "Guest"("user_id", "event_id");

-- AddForeignKey
ALTER TABLE "RsvpPreferences" ADD CONSTRAINT "RsvpPreferences_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpPreferences" ADD CONSTRAINT "RsvpPreferences_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "GuestGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
