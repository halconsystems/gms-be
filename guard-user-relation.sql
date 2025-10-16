-- Add userId column to Guard table with proper constraint
ALTER TABLE "Guard" ADD COLUMN IF NOT EXISTS "userId" UUID REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Guard" ADD CONSTRAINT "Guard_userId_key" UNIQUE ("userId");