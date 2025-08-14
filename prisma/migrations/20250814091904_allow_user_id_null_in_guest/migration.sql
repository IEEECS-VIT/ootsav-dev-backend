-- DropForeignKey
ALTER TABLE "Guest" DROP CONSTRAINT "Guest_user_id_fkey";

-- DropIndex
DROP INDEX "Guest_user_id_event_id_key";

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "email" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone_no" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
