import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { PrismaService } from 'src/prisma/prisma.service';

export function shouldFilterByOffice(user: any, options?: { allowStaff?: boolean }): { shouldFilter: boolean; officeId?: string } {
  const allowStaff = options?.allowStaff === true;
  if (!user) return { shouldFilter: false };
  const role = user.role;
  if (!role) return { shouldFilter: false };
  const roleNormalized = typeof role === 'string' ? role.toLowerCase() : role;

  const isManager = roleNormalized === RolesEnum.manager;
  const isStaff = roleNormalized === RolesEnum.staff;

  if (isManager || (allowStaff && isStaff)) {
    if (!user.officeId) {
      throw new ForbiddenException('No office assigned');
    }
    return { shouldFilter: true, officeId: user.officeId };
  }

  return { shouldFilter: false };
}

/**
 * Determine if we should filter data by supervisor-assigned locations for the given user.
 * This is async because it queries the database for the user's employee record and assignments.
 *
 * @param user The authenticated request user (must contain `id` / `userId`)
 * @param prisma PrismaService instance to query assignments
 * @returns { shouldFilter: boolean; locationIds?: string[] }
 */
export async function shouldFilterByLocation(user: any, prisma: PrismaService): Promise<{ shouldFilter: boolean; locationIds?: string[] }>{
  if (!user) return { shouldFilter: false };
  const role = user.role;
  if (!role) return { shouldFilter: false };
  const roleNormalized = typeof role === 'string' ? role.toLowerCase() : role;

  const isSupervisor = roleNormalized === RolesEnum.supervisor || roleNormalized === RolesEnum.guardSupervisor;

  if (!isSupervisor) return { shouldFilter: false };

  // Resolve userId (support legacy shapes)
  const userId = user.id || user.userId || user.sub;
  if (!userId) throw new ForbiddenException('Supervisor must have a linked user id');

  // Find employee for this user
  const employee = await prisma.employee.findFirst({ where: { userId } });
  if (!employee) throw new ForbiddenException('Supervisor must have an employee record');

  // Find active assignments for this supervisor
  const assignments = await prisma.assignedSupervisor.findMany({ where: { supervisorEmployeeId: employee.id, deploymentTill: null } });

  const locationIds = assignments.map((a) => a.locationId).filter(Boolean);

  return { shouldFilter: true, locationIds };
}

/**
 * Helper that centralizes supervisor location filtering behavior.
 * - Returns { shouldFilter: false } for non-supervisors
 * - Calls shouldFilterByLocation for supervisors and allows exceptions to propagate
 * - Normalizes locationIds to an empty array when no assignments
 */
export async function getSupervisorLocationFilter(user: any, prisma: PrismaService): Promise<{ shouldFilter: boolean; locationIds?: string[] }>{
  if (!user) return { shouldFilter: false };
  const role = user.role;
  if (!role) return { shouldFilter: false };
  const roleNormalized = typeof role === 'string' ? role.toLowerCase() : role;

  const isSupervisor = roleNormalized === RolesEnum.supervisor || roleNormalized === RolesEnum.guardSupervisor;
  if (!isSupervisor) return { shouldFilter: false };

  // Delegate to shouldFilterByLocation which performs detailed checks and will throw when linkage is invalid
  const filter = await shouldFilterByLocation(user, prisma);

  if (filter.shouldFilter) {
    return { shouldFilter: true, locationIds: filter.locationIds ?? [] };
  }

  return { shouldFilter: false };
}
