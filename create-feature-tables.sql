-- Create Feature table
CREATE TABLE IF NOT EXISTS "Feature" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) UNIQUE NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(6) DEFAULT NOW(),
  "updatedAt" TIMESTAMP(6) DEFAULT NOW()
);

-- Create OrganizationFeature table
CREATE TABLE IF NOT EXISTS "OrganizationFeature" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "featureId" UUID NOT NULL REFERENCES "Feature"(id) ON DELETE CASCADE,
  UNIQUE ("organizationId", "featureId")
);