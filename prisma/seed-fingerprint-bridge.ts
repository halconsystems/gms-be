/**
 * Seeds org / office / OfficeAgent / test user for local fingerprint-bridge testing.
 *
 * Run: npx ts-node --transpile-only prisma/seed-fingerprint-bridge.ts
 * Or:  npm run seed:fingerprint-bridge
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { RolesEnum } from '../src/common/enums/roles-enum';
import { OrganizationFeatures } from '../src/common/constants/features';

const prisma = new PrismaClient();

/** Stable IDs — copy into agent appsettings.json for local testing */
export const FINGERPRINT_BRIDGE_TEST = {
  organizationId: 'f1111111-1111-4111-8111-111111111111',
  officeId: 'f2222222-2222-4222-8222-222222222222',
  officeAgentId: 'a3333333-3333-4333-8333-333333333333',
  userId: 'a4444444-4444-4444-8444-444444444444',
  agentSecret: 'dev-office-agent-secret',
  userEmail: 'fingerprint-tester@guardsos.com',
  userPassword: 'Test@123',
  organizationName: 'Fingerprint Bridge Test Org',
  officeName: 'Test Office (Local)',
  backendWsUrl: 'ws://localhost:5001/api/agents/ws',
  /** Features enabled on the test org (sidebar + JWT) */
  enabledFeatures: [
    OrganizationFeatures.SETUP,
    OrganizationFeatures.REGISTRATION,
  ],
  subFeaturesData: {
    [OrganizationFeatures.SETUP]: [
      'setup-create-office',
      'setup-create-user',
      'setup-create-client-user',
      'setup-add-guards-category',
    ],
    [OrganizationFeatures.REGISTRATION]: [
      'guards-registration',
      'employee-registration',
      'clients-registration',
      'location-registration',
    ],
  },
} as const;

async function ensureRole(roleName: string) {
  const existing = await prisma.role.findFirst({ where: { roleName } });
  if (existing) {
    return existing;
  }
  return prisma.role.create({ data: { roleName } });
}

async function ensureFeature(featureName: string) {
  const existing = await prisma.feature.findUnique({ where: { name: featureName } });
  if (existing) {
    return existing;
  }
  return prisma.feature.create({
    data: { name: featureName, description: `${featureName} (seed)` },
  });
}

async function assignOrganizationFeatures(
  organizationId: string,
  featureNames: readonly string[],
) {
  for (const featureName of featureNames) {
    const feature = await ensureFeature(featureName);
    await prisma.organizationFeature.upsert({
      where: {
        organizationId_featureId: {
          organizationId,
          featureId: feature.id,
        },
      },
      create: {
        organizationId,
        featureId: feature.id,
      },
      update: {},
    });
  }
}

async function main() {
  const cfg = FINGERPRINT_BRIDGE_TEST;
  console.log('🌱 Seeding fingerprint bridge test data...\n');

  const passwordHash = await bcrypt.hash(cfg.userPassword, 10);
  const agentSecretHash = await bcrypt.hash(cfg.agentSecret, 10);

  const managerRole = await ensureRole(RolesEnum.manager);
  const orgAdminRole = await ensureRole(RolesEnum.organizationAdmin);

  const user = await prisma.user.upsert({
    where: { email: cfg.userEmail },
    create: {
      id: cfg.userId,
      email: cfg.userEmail,
      password: passwordHash,
      userName: 'Fingerprint Tester',
      isActive: true,
    },
    update: {
      password: passwordHash,
      userName: 'Fingerprint Tester',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: managerRole.id,
      },
    },
    create: {
      userId: user.id,
      roleId: managerRole.id,
    },
    update: {},
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: orgAdminRole.id,
      },
    },
    create: {
      userId: user.id,
      roleId: orgAdminRole.id,
    },
    update: {},
  });

  const organization = await prisma.organization.upsert({
    where: { id: cfg.organizationId },
    create: {
      id: cfg.organizationId,
      organizationName: cfg.organizationName,
      userId: user.id,
      addressLine1: '1 Test Street',
      city: 'Test City',
      phoneNumber1: '+920000000000',
      province: 'Test Province',
      isActive: true,
      subFeaturesData: cfg.subFeaturesData,
    },
    update: {
      organizationName: cfg.organizationName,
      isActive: true,
      subFeaturesData: cfg.subFeaturesData,
    },
  });

  await assignOrganizationFeatures(organization.id, cfg.enabledFeatures);

  const office = await prisma.office.upsert({
    where: { id: cfg.officeId },
    create: {
      id: cfg.officeId,
      organizationId: organization.id,
      branchName: cfg.officeName,
      province: 'Test Province',
      contactNumber: '+920000000001',
      email: 'test-office@guardsos.local',
      address: '1 Test Street',
      city: 'Test City',
      isActive: true,
    },
    update: {
      branchName: cfg.officeName,
      isActive: true,
    },
  });

  await prisma.userOffice.upsert({
    where: {
      userId_organizationId_officeId: {
        userId: user.id,
        organizationId: organization.id,
        officeId: office.id,
      },
    },
    create: {
      userId: user.id,
      organizationId: organization.id,
      officeId: office.id,
    },
    update: {},
  });

  const officeAgent = await prisma.officeAgent.upsert({
    where: { officeId: office.id },
    create: {
      id: cfg.officeAgentId,
      organizationId: organization.id,
      officeId: office.id,
      agentSecretHash,
      status: 'OFFLINE',
    },
    update: {
      organizationId: organization.id,
      agentSecretHash,
    },
  });

  const credentialsPath = path.join(
    __dirname,
    'fingerprint-bridge-test.credentials.json',
  );

  const credentials = {
    portalLogin: {
      email: cfg.userEmail,
      password: cfg.userPassword,
    },
    agentAppsettings: {
      OrgId: organization.id,
      OfficeId: office.id,
      AgentSecret: cfg.agentSecret,
      BackendWsUrl: cfg.backendWsUrl,
    },
    database: {
      officeAgentId: officeAgent.id,
      organizationId: organization.id,
      officeId: office.id,
      userId: user.id,
    },
    seededAt: new Date().toISOString(),
  };

  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));

  console.log('✅ Fingerprint bridge test data ready\n');
  console.log('── Features enabled ──');
  console.log(`   ${cfg.enabledFeatures.join(', ')}`);
  console.log(`   Registration sub-features: ${cfg.subFeaturesData[OrganizationFeatures.REGISTRATION].join(', ')}`);
  console.log('');
  console.log('── Portal login (log out and back in to refresh JWT features) ──');
  console.log(`   Email:    ${cfg.userEmail}`);
  console.log(`   Password: ${cfg.userPassword}`);
  console.log('');
  console.log('── Agent appsettings.json (Agent section) ──');
  console.log(`   OrgId:         ${organization.id}`);
  console.log(`   OfficeId:      ${office.id}`);
  console.log(`   AgentSecret:   ${cfg.agentSecret}`);
  console.log(`   BackendWsUrl:  ${cfg.backendWsUrl}`);
  console.log('');
  console.log(`── Credentials file ──`);
  console.log(`   ${credentialsPath}`);
  console.log('');
  console.log('Next: restart C# agent with the OrgId/OfficeId/AgentSecret above, then log in to the portal.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('❌ Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
