-- CreateTable
CREATE TABLE "EventGuestGroup" (
    "event_id" TEXT NOT NULL,
    "guest_group_id" TEXT NOT NULL,

    CONSTRAINT "EventGuestGroup_pkey" PRIMARY KEY ("event_id","guest_group_id")
);

-- AddForeignKey
ALTER TABLE "EventGuestGroup" ADD CONSTRAINT "EventGuestGroup_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGuestGroup" ADD CONSTRAINT "EventGuestGroup_guest_group_id_fkey" FOREIGN KEY ("guest_group_id") REFERENCES "GuestGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
