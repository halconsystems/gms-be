import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { fullUserInclude, FullUserType } from './types/full-user.type';
import { RolesEnum } from 'src/common/enums/roles-enum';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  /** ---------------- USER SIGNUP ---------------- */
  async signup(dto: SignupDto) {
    const user = await this.userService.create(
      {
        email: dto.email,
        password: dto.password,
        userName: dto.userName,
        profileImage: dto.profileImage,
        roleName: dto.roleName,
        officeId: dto.officeId,
      },
      dto.organizationId,
    );

    const rawUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { 
        userRoles: { include: { role: true } }, 
        userOffice: {
          include: {
            office: {
              select: {
                id: true,
                branchName: true,
                city: true,
                province: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
        client: true,
      },
    });

    if (!rawUser) throw new NotFoundException('User not found');

    const fullUser = {
      ...rawUser,
      client: rawUser.client ? {
        ...rawUser.client,
        contractNumber: BigInt(rawUser.client.contractNumber)
      } : null
    };

    const roleName = fullUser.userRoles[0].role.roleName;
    const organizationId =
      fullUser.userOffice.length > 0
        ? fullUser.userOffice[0].organizationId
        : null;

    const token = this.jwtService.sign({
      sub: fullUser.id, // Standard JWT 'sub' claim for subject (user ID)
      email: fullUser.email,
      roleName,
      organizationId,
      officeId: fullUser.userOffice?.[0]?.officeId,
      clientId: fullUser.client?.id, // Include clientId if user has client association
    });

    // Get office data if available
    const officeData = fullUser.userOffice?.[0]?.office || null;

    return { 
      user: {
        ...fullUser,
        office: officeData,
      }, 
      token: token 
    };
  }

  /** ---------------- USER LOGIN ---------------- */
  async login(dto: LoginDto) {
    try {
      // Use the predefined type for full user with relations

      // Find user with roles and direct organization relation first
      const rawUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: fullUserInclude,
      });

      if (!rawUser) throw new NotFoundException('User not found');

      // Convert contract number to bigint
      const user: FullUserType = {
        ...rawUser,
        client: rawUser.client ? {
          ...rawUser.client,
          contractNumber: BigInt(rawUser.client.contractNumber)
        } : null
      };

      console.log('Debug user data:', {
        userId: user.id,
        userRoles: user.userRoles?.map((ur) => ur.role?.roleName),
        hasDirectOrg: !!user.organizations,
        userOfficeCount: user.userOffice?.length,
        firstOffice: user.userOffice?.[0]
          ? {
              officeId: user.userOffice[0].officeId,
              orgId: user.userOffice[0].organizationId,
            }
          : null,
      });

      // Debug logs to trace the issue
      console.log('User found:', {
        id: user.id,
        email: user.email,
        userOfficeCount: user.userOffice?.length,
        hasUserOffice: !!user.userOffice?.length,
        firstOfficeOrgId: user.userOffice?.[0]?.organizationId,
        organization: user.userOffice?.[0]?.organization,
      });

      const valid = await bcrypt.compare(dto.password, user.password);
      if (!valid) throw new UnauthorizedException('Invalid credentials');

      // Get user's roles
      const userRoles = user.userRoles?.map((ur) => ur.role?.roleName) || [];
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
        finalOrgId: organizationId,
      });

      // Get features from organization
      let features: string[] = [];
      let subFeatures: { [key: string]: string[] } = {};
      if (organization?.organizationFeatures) {
        features = organization.organizationFeatures.map(
          (of) => of.feature.name,
        );
      }
      
      // Get sub-features from organization if available
      if (organization?.subFeaturesData) {
        subFeatures = organization.subFeaturesData as { [key: string]: string[] };
      }

      console.log('Features loaded for user:', {
        userId: user.id,
        features,
        isOrgAdmin,
        orgName: organization?.organizationName,
      });

      const roleName = user.userRoles?.[0]?.role?.roleName ?? 'user';

      // Generate JWT token with user info and features
      const token = this.jwtService.sign({
        sub: user.id, // Standard JWT 'sub' claim for subject (user ID)
        email: user.email,
        roleName,
        organizationId,
        features,
        officeId: user.userOffice?.[0]?.officeId,
        clientId: user.client?.id, // Include clientId if user has client association
      });

      // Get supervisor info if user has supervisor role
      let supervisorInfo: any = null;
      const isSupervisor = userRoles.includes(RolesEnum.supervisor);
      const firstEmployee = user.employee?.[0];

      if (isSupervisor && firstEmployee?.supervisorFor) {
        const locations = firstEmployee.supervisorFor.map((sup) => {
          const location = sup.location;
          return {
            id: location.id,
            locationName: location.locationName,
            address: location.address,
            city: location.city,
            client: {
              id: sup.client.id,
              companyName: sup.client.companyName,
              contactNumber: sup.client.contactNumber,
            },
            guards: {
              totalCount: location.assignedGuard.length,
              list: location.assignedGuard.map((ag) => ({
                id: ag.id,
                guardId: ag.guard.id,
                name: ag.guard.fullName,
                serviceNumber: ag.guard.serviceNumber,
                contactNumber: ag.guard.contactNumber,
                category: ag.guardCategory.categoryName,
              })),
            },
          };
        });

        supervisorInfo = {
          employeeId: firstEmployee.id,
          serviceNumber: firstEmployee.serviceNumber,
          locations: locations,
        };
      }

      // Format login response with defensive null checks
      const officeData = user.userOffice?.[0]?.office || null;
      
      return {
        token: token,
        user: {
          id: user.id,
          userName: user.userName,
          email: user.email,
          organizationId,
          organizationName: organization?.organizationName ?? null,
          features,
          subFeatures,
          roleName,
          isSuperAdmin,
          isSupervisor,
          supervisorInfo,
          office: officeData ? {
            id: officeData.id,
            branchName: officeData.branchName,
            city: officeData.city,
            province: officeData.province,
            email: officeData.email,
            contactNumber: officeData.contactNumber,
          } : null,
          client: user.client ? {
            id: user.client.id,
            companyName: user.client.companyName,
            officialEmail: user.client.officialEmail,
            contractNumber: user.client.contractNumber.toString()
          } : null,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Login failed. Please try again.');
    }
  }
}
