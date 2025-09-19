import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { userRoles: { include: { role: true } }, userOffice: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const roleName = user.userRoles[0].role.roleName;
    const organizationId = user.userOffice.length > 0 ? user.userOffice[0].organizationId : null;

    const token = this.jwtService.sign({ userId: user.id, email: user.email, roleName, organizationId });

    return { token: token, user: { id: user.id, email: user.email, userName: user.userName, roleName, organizationId } };
  }
}
