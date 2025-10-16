import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyConstraints() {
  try {
    const employeeConstraints = await prisma.$queryRaw`
      SELECT con.conname, rel.relname
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'Employee' AND con.contype = 'u'`;
    
    const guardConstraints = await prisma.$queryRaw`
      SELECT con.conname, rel.relname
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'Guard' AND con.contype = 'u'`;

    console.log('Employee Constraints:', employeeConstraints);
    console.log('Guard Constraints:', guardConstraints);
  } catch (error) {
    console.error('Error verifying constraints:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyConstraints();