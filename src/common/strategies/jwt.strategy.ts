import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, PrismaClient } from '@prisma/client';

// Define expected JWT payload shape
interface JwtPayload {
  sub: string; // User ID
  email: string; // User email
  organizationId?: string; // Organization ID (optional because superAdmin might not have one)
  features?: string[]; // Organization features
  role?: string; // User role
  clientId?: string; // Client ID for client users
  iat?: number; // Issued at
  exp?: number; // Expiration
}

type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    userOffice: {
      include: {
        organization: {
          include: {
            organizationFeatures: {
              include: {
                feature: true;
              };
            };
          };
        };
      };
    };
    userRoles: {
      include: {
        role: true;
      };
    };
    client: true;
  };
}>;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService & PrismaClient,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret, // Now properly typed as string
    });
  }

  /**
   * Validate and enrich the JWT payload
   * This method is called by Passport.js after token is verified
   */
  async validate(payload: JwtPayload) {
    try {
      this.logger.debug(`Validating JWT payload for user: ${payload.email}`);

      // 1. Basic payload validation
      if (!payload.sub || !payload.email) {
        this.logger.error('JWT payload missing required fields', payload);
        throw new UnauthorizedException('Invalid token format');
      }

      // 2. Fetch latest user data from database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
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
          userRoles: {
            include: {
              role: true,
            },
          },
          client: true,
        },
      });

      const validatedUser = user as UserWithRelations;
      if (!validatedUser) {
        this.logger.error(`User not found for sub: ${payload.sub}`);
        throw new UnauthorizedException('User not found');
      }

      // 3. Get organization info (if not superadmin)
      const organization = validatedUser.userOffice?.[0]?.organization;
      const organizationId = organization?.id;
      const features =
        organization?.organizationFeatures?.map((f) => f.feature.name) || [];

      // 4. Check role (superadmin doesn't need organizationId)
      const isSuperAdmin = validatedUser.userRoles.some(
        (ur) => ur.role.roleName === 'superAdmin',
      );

      if (!isSuperAdmin && !organizationId) {
        this.logger.warn(
          `Non-superadmin user ${validatedUser.id} has no organization`,
        );
        throw new UnauthorizedException('User has no organization access');
      } // 5. If no features found for organization user, log warning
      if (!isSuperAdmin && organizationId && features.length === 0) {
        this.logger.warn(
          `User ${validatedUser.id} organization ${organizationId} has no features`,
        );
      }

      // 6. Return enriched user object
      // Extract officeId if available; leave undefined for superAdmin or users without an office
      const officeId = isSuperAdmin
        ? undefined
        : validatedUser.userOffice?.[0]?.officeId;

      // This becomes available as req.user in your controllers/decorators
      return {
        id: validatedUser.id,
        email: validatedUser.email,
        organizationId, // Will be undefined for superadmin
        features, // Empty array if no features
        isSuperAdmin,
        role: validatedUser.userRoles[0]?.role.roleName || 'user',
        officeId,
        clientId: validatedUser.client?.id, // Include clientId if user has client association
      };
    } catch (error) {
      // Log unexpected errors but don't expose internals
      if (!(error instanceof UnauthorizedException)) {
        this.logger.error('Error validating JWT:', error);
        throw new UnauthorizedException('Authentication failed');
      }
      throw error;
    }
  }
}
