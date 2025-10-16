import { Injectable, NotFoundException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { fullUserInclude, FullUserType } from './types/full-user.type';
import { RolesEnum } from 'src/common/enums/roles-enum';

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
      // Use the predefined type for full user with relations

      // Find user with roles and direct organization relation first
      const user: FullUserType | null = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: fullUserInclude
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

      // Get user's roles
      const userRoles = user.userRoles?.map(ur => ur.role?.roleName) || [];
      const isSuperAdmin = userRoles.includes(RolesEnum.superAdmin);
      const isOrgAdmin = userRoles.includes(RolesEnum.organizationAdmin);

      // For organization admins, use their direct organization relation
      // For other users, use their office's organization
      let organization;
      let organizationId;

      if (isOrgAdmin) {
        organization = user.organizations;
        organizationId = organization?.id;
      } else {
        organization = user.userOffice?.[0]?.organization;
        organizationId = user.userOffice?.[0]?.organizationId;
      }

      console.log('Organization resolution:', {
        isOrgAdmin,
        userRoles,
        fromDirectRelation: user.organizations?.organizationName,
        fromUserOffice: user.userOffice?.[0]?.organization?.organizationName,
        finalOrgId: organizationId
      });
      
      // Get features from organization
      let features: string[] = [];
      if (organization?.organizationFeatures) {
        features = organization.organizationFeatures.map(of => of.feature.name);
      }
      
      console.log('Features loaded for user:', { 
        userId: user.id, 
        features, 
        isOrgAdmin,
        orgName: organization?.organizationName 
      });

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