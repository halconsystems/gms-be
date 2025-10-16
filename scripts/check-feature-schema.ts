import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFeatureSchema() {
  try {
    // Get a sample feature to check its structure
    // Features are now stored directly in Feature model
    const sampleFeature = await prisma.feature.findFirst({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        organizationFeatures: {
          select: {
            organizationId: true
          }
        }
      }
    });
    
    console.log('Sample Feature Structure:', sampleFeature);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFeatureSchema();