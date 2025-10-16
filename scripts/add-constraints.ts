import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addConstraints() {
  try {
    await prisma.$executeRaw`ALTER TABLE "Employee" ADD CONSTRAINT "unique_employee_org_service" UNIQUE ("organizationId", "serviceNumber")`;
    await prisma.$executeRaw`ALTER TABLE "Guard" ADD CONSTRAINT "unique_guard_org_service" UNIQUE ("organizationId", "serviceNumber")`;
    console.log('Constraints added successfully');
  } catch (error) {
    console.error('Error adding constraints:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addConstraints();