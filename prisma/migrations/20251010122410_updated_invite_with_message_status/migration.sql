-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('delivered', 'failed_delivery');

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "message_status" "MessageStatus";
