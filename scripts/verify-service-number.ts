import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyServiceNumber() {
  try {
    // 1. Check if service number constraints exist
    const constraintsQuery = Prisma.sql`
      SELECT tc.table_name, tc.constraint_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'UNIQUE' 
        AND (tc.table_name = 'Employee' OR tc.table_name = 'Guard')
        AND kcu.column_name IN ('serviceNumber', 'organizationId');
    `;
    
    const constraints = await prisma.$queryRaw(constraintsQuery);
    console.log('Service Number Constraints:', constraints);

    // 2. Check the foreign key constraints for user relations
    const fkQuery = Prisma.sql`
      SELECT tc.table_name, kcu.column_name, ccu.table_name as foreign_table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name = 'Employee' OR tc.table_name = 'Guard')
        AND kcu.column_name = 'userId';
    `;
    
    const relations = await prisma.$queryRaw(fkQuery);
    console.log('User Relations:', relations);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyServiceNumber();