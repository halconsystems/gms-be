import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/role.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();


    // Accept a variety of user id fields produced by different auth strategies
    const userId = user?.userId || user?.id || user?.sub;

    // Resolve roles from multiple possible shapes. Support:
    // - user.userRoles: array of strings OR array of objects like { roleName } or { role: { roleName } }
    // - user.role (string)
    // - user.roleName (string)
    let userRoles: string[] = [];
    if (Array.isArray(user?.userRoles) && user.userRoles.length > 0) {
      userRoles = user.userRoles
        .map((r) => {
          if (!r) return undefined;
          if (typeof r === 'string') return r;
          // r might be an object. Try common shapes.
          if (typeof r === 'object') {
            if (typeof r.roleName === 'string') return r.roleName;
            if (typeof r.role === 'string') return r.role;
            if (r.role && typeof r.role.roleName === 'string') return r.role.roleName;
          }
          return undefined;
        })
        .filter(Boolean) as string[];
    }

    if (userRoles.length === 0) {
      if (typeof user?.role === 'string') userRoles = [user.role];
      else if (typeof user?.roleName === 'string') userRoles = [user.roleName];
    }

    const isSupervisor = user?.isSupervisor === true || userRoles.map(r => r.toLowerCase()).includes('supervisor');

    // If we couldn't determine a userId, still proceed with role checks but log/deny explicitly.
    if (!userId && userRoles.length === 0) {
      throw new ForbiddenException('Missing user identification in token');
    }

    // Convert both required roles and user roles to lowercase for case-insensitive comparison
  const normalizedUserRoles = userRoles.map((role) => role.toLowerCase());
    const normalizedRequiredRoles = requiredRoles.map((role) => role.toLowerCase());

    // Check if user has any of the required roles
    const hasRequiredRole = normalizedRequiredRoles.some((role) =>
      normalizedUserRoles.includes(role) || (role === 'supervisor' && isSupervisor),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
