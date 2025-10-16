import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/role.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user?.userId) {
      throw new ForbiddenException('Missing userId in token');
    }

    // Get all roles from user (could be multiple roles)
    const userRoles = user.userRoles || [user.roleName];
    const isSupervisor = user.isSupervisor === true;

    // Convert both required roles and user roles to lowercase for case-insensitive comparison
    const normalizedUserRoles = userRoles.map(role => role.toLowerCase());
    const normalizedRequiredRoles = requiredRoles.map(role => role.toLowerCase());

    // Check if user has any of the required roles
    const hasRequiredRole = normalizedRequiredRoles.some(role => 
      normalizedUserRoles.includes(role) || (role === 'supervisor' && isSupervisor)
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
