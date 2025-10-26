import { PrismaClient } from '@prisma/client';
import { RolesEnum } from '../src/common/enums/roles-enum';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createSuperAdmin() {
  console.log('🌱 Starting superadmin creation...');
  
  const superadminEmail = 'superadmin@guardsos.com';
  const existingUser = await prisma.user.findUnique({
    where: { email: superadminEmail }
  });

  if (existingUser) {
    console.log('⚡ Superadmin already exists');
    return;
  }

  // Create superadmin user
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  const superadmin = await prisma.user.create({
    data: {
      email: superadminEmail,
      password: hashedPassword,
      userName: 'Super Admin',
      isActive: true
    }
  });

  // Get the superadmin role
  const superadminRole = await prisma.role.findFirst({
    where: { roleName: RolesEnum.superAdmin }
  });

  if (!superadminRole) {
    throw new Error('Superadmin role not found. Please run role seeding first.');
  }

  // Assign superadmin role
  await prisma.userRole.create({
    data: {
      userId: superadmin.id,
      roleId: superadminRole.id
    }
  });

  console.log('✅ Superadmin created successfully');
}

async function main() {
  // First seed roles since superadmin creation depends on it
  console.log('🌱 Starting role seeding...');

  const roles = Object.values(RolesEnum);

  for (const roleName of roles) {
    const existing = await prisma.role.findFirst({ where: { roleName } });
    if (!existing) {
      await prisma.role.create({ data: { roleName } });
      console.log(`✅ Role created: ${roleName}`);
    } else {
      console.log(`⚡ Role already exists: ${roleName}`);
    }
  }

  // Seed default shifts if they don't exist
  console.log('🌱 Starting shifts seeding...');
  const defaultShifts = ['Morning', 'Evening', 'Night'];
  for (const shiftName of defaultShifts) {
    const existingShift = await prisma.shift.findFirst({ where: { shiftName } });
    if (!existingShift) {
      await prisma.shift.create({ data: { shiftName } });
      console.log(`✅ Shift created: ${shiftName}`);
    } else {
      console.log(`⚡ Shift already exists: ${shiftName}`);
    }
  }

  // Seed default location types
  console.log('🌱 Starting location types seeding...');
  const defaultLocationTypes = [
    
    'Residential Building',
    'Industrial Site',
    'Retail Store',
    'Office ',
    'Warehouse'
  ];

  for (const type of defaultLocationTypes) {
    const existingType = await prisma.locationType.findFirst({ 
      where: { type } 
    });
    if (!existingType) {
      await prisma.locationType.create({ 
        data: { type } 
      });
      console.log(`✅ Location type created: ${type}`);
    } else {
      console.log(`⚡ Location type already exists: ${type}`);
    }
  }

  // Create superadmin user
  await createSuperAdmin();

  console.log('🎉 Seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });