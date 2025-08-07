/*
  Warnings:

  - The values [Anniversary] on the enum `EventType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `co_hosts` on the `SubEvent` table. All the data in the column will be lost.
  - You are about to drop the `AnniversaryEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EventType_new" AS ENUM ('Wedding', 'Birthday', 'Houseparty', 'Travel');
ALTER TABLE "Event" ALTER COLUMN "type" TYPE "EventType_new" USING ("type"::text::"EventType_new");
ALTER TYPE "EventType" RENAME TO "EventType_old";
ALTER TYPE "EventType_new" RENAME TO "EventType";
DROP TYPE "EventType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AnniversaryEvent" DROP CONSTRAINT "AnniversaryEvent_id_fkey";

-- AlterTable
ALTER TABLE "SubEvent" DROP COLUMN "co_hosts";

-- DropTable
DROP TABLE "AnniversaryEvent";
