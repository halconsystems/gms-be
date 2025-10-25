import { Prisma } from '@prisma/client';

export const fullUserInclude = {
  userRoles: {
    include: {
      role: true,
    },
  },
  employee: {
    include: {
      supervisorFor: {
        include: {
          client: true,
          location: {
            include: {
              assignedGuard: {
                where: {
                  deploymentTill: null,
                },
                include: {
                  guard: {
                    select: {
                      id: true,
                      fullName: true,
                      serviceNumber: true,
                      contactNumber: true,
                    },
                  },
                  guardCategory: {
                    select: {
                      categoryName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  organizations: {
    include: {
      organizationFeatures: {
        include: {
          feature: true,
        },
      },
    },
  },
  userOffice: {
    include: {
      organization: {
        include: {
          organizationFeatures: {
            include: {
              feature: true,
            },
          },
        },
      },
    },
  },
} as const;

type FullUserEmployee = {
  id: string;
  userId: string | null;
  organizationId: string;
  registrationDate: Date | null;
  serviceNumber: number;
  fullName: string;
  createdAt: Date;
  isActive: boolean;
  updatedAt: Date;
  supervisorFor: Array<{
    id: string;
    locationId: string;
    employeeId: string;
    supervisorEmployeeId: string;
    clientId: string;
    deploymentDate: Date;
    deploymentTill: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    client: {
      id: string;
      companyName: string;
      contactNumber: string;
    };
    location: {
      id: string;
      locationName: string;
      address: string;
      city: string;
      assignedGuard: Array<{
        id: string;
        guardId: string;
        locationId: string;
        deploymentDate: Date;
        deploymentTill: Date | null;
        guard: {
          id: string;
          fullName: string;
          serviceNumber: number;
          contactNumber: string;
        };
        guardCategory: {
          categoryName: string;
        };
      }>;
    };
  }>;
};

export type FullUserType = {
  id: string;
  email: string;
  password: string;
  userName: string;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  userRoles: Array<{
    id: string;
    userId: string;
    roleId: string;
    role: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      isActive: boolean;
      roleName: string;
    };
  }>;
  employee: FullUserEmployee[] | null;
  organizations: {
    id: string;
    organizationName: string;
    organizationFeatures: Array<{
      feature: {
        name: string;
      };
    }>;
  } | null;
  userOffice: Array<{
    id: string;
    userId: string;
    organizationId: string;
    officeId: string;
    organization: {
      id: string;
      organizationName: string;
      organizationFeatures: Array<{
        feature: {
          name: string;
        };
      }>;
    };
  }>;
};
