import { Injectable, NotFoundException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import type { User, UserRole, Role, UserOffice, Organization, Feature } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService, private userService: UserService) {}

  /** ---------------- USER SIGNUP ---------------- */
  async signup(dto: CreateUserDto) {
    const user = await this.userService.create(dto);

    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { userRoles: { include: { role: true } }, userOffice: true },
    });

    if (!fullUser) throw new NotFoundException('User not found');

    const roleName = fullUser.userRoles[0].role.roleName;
    const organizationId = fullUser.userOffice.length > 0 ? fullUser.userOffice[0].organizationId : null;

    const token = this.jwtService.sign({ userId: fullUser.id, email: fullUser.email, roleName, organizationId });

    return { user: fullUser, token: token };
  }

  /** ---------------- USER LOGIN ---------------- */
  async login(dto: LoginDto) {
    try {
      // Find user with roles and direct organization relation first
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: {
          userRoles: { 
            include: { 
              role: true 
            } 
          },
          organizations: true, // Direct organization relation
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
        }
      });

      if (!user) throw new NotFoundException('User not found');
      
      console.log('Debug user data:', {
        userId: user.id,
        userRoles: user.userRoles?.map(ur => ur.role?.roleName),
        hasDirectOrg: !!user.organizations,
        userOfficeCount: user.userOffice?.length,
        firstOffice: user.userOffice?.[0] ? {
          officeId: user.userOffice[0].officeId,
          orgId: user.userOffice[0].organizationId
        } : null
      });
      
      // Debug logs to trace the issue
      console.log('User found:', { 
        id: user.id,
        email: user.email,
        userOfficeCount: user.userOffice?.length,
        hasUserOffice: !!user.userOffice?.length,
        firstOfficeOrgId: user.userOffice?.[0]?.organizationId,
        organization: user.userOffice?.[0]?.organization
      });

      const valid = await bcrypt.compare(dto.password, user.password);
      if (!valid) throw new UnauthorizedException('Invalid credentials');

      // Check if user is superadmin using case-insensitive comparison
      const isSuperAdmin = user.userRoles?.some(
        ur => ur.role?.roleName?.toLowerCase() === 'superadmin'
      );

      // Try to get organization from both possible relations
      const organization = user.organizations || user.userOffice?.[0]?.organization;
      const organizationId = organization?.id || user.userOffice?.[0]?.organizationId;

      console.log('Organization resolution:', {
        fromDirectRelation: user.organizations?.organizationName,
        fromUserOffice: user.userOffice?.[0]?.organization?.organizationName,
        finalOrgId: organizationId
      });
      
      // Get features based on user role
      let features: string[] = [];
      
      if (isSuperAdmin) {
        // Super admins get access to all features
        const allFeatures = await this.prisma.feature.findMany();
        features = allFeatures.map(f => f.name);
        console.log('Superadmin features:', features);
      } else if (organizationId) {
        // Regular users: fetch features directly from OrganizationFeature table
        const orgFeatures = await this.prisma.organizationFeature.findMany({
          where: { organizationId },
          include: { feature: true }
        });
        features = orgFeatures.map(of => of.feature.name);
        console.log('Organization features for org:', organizationId, features);
      } else {
        console.log('No organization found for user:', user.id);
      }

      const roleName = user.userRoles?.[0]?.role?.roleName ?? 'user';

      // Generate JWT token with user info and features
      const token = this.jwtService.sign({ 
        userId: user.id, 
        email: user.email, 
        roleName, 
        organizationId,
        features 
      });

      // Format login response with defensive null checks
      return { 
        token: token, // Changed from token to accessToken
        user: { 
          id: user.id, 
          userName: user.userName,
          email: user.email, 
          organizationId,
          organizationName: organization?.organizationName ?? null,
          features,
          roleName,
          isSuperAdmin
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Login failed. Please try again.');
    }
  }
}