-- AlterTable
ALTER TABLE "public"."Guard" ADD COLUMN     "userId" UUID;

-- AddForeignKey
ALTER TABLE "public"."Guard" ADD CONSTRAINT "Guard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
