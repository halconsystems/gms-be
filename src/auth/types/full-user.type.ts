import { Prisma } from '@prisma/client';

export const fullUserInclude = {
  userRoles: { 
    include: { 
      role: true 
    } 
  },
  organizations: {
    include: {
      organizationFeatures: {
        include: {
          feature: true
        }
      }
    }
  },
  employee: true,
  userOffice: { 
    include: { 
      organization: {
        include: {
          organizationFeatures: {
            include: {
              feature: true
            }
          }
        }
      }
    }
  }
} as const;

export type FullUserType = Prisma.UserGetPayload<{ 
  include: { 
    userRoles: { 
      include: { 
        role: true;
      }; 
    };
    organizations: {
      include: {
        organizationFeatures: {
          include: {
            feature: true
          }
        }
      }
    };
    employee: true;
    userOffice: { 
      include: { 
        organization: {
          include: {
            organizationFeatures: {
              include: {
                feature: true
              }
            }
          }
        }
      };
    };
  }; 
}>;