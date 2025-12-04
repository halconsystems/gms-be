import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET_KEY')!,
    });
  }

  async validate(payload: any) {
    // Attach user info to request
    // JWT tokens use 'sub' claim for user ID (standard JWT format)
    // Extract officeId if present in the token payload (some tokens include userOffice or officeId)
    const officeId =
      payload.officeId || (payload.userOffice && payload.userOffice[0]?.officeId);

    return {
      id: payload.sub, // Use 'sub' from JWT (standard subject/user ID claim)
      userId: payload.sub, // Also provide userId for compatibility
      email: payload.email,
      roleName: payload.roleName,
      organizationId: payload.organizationId || null,
      officeId: officeId || undefined,
      userRoles: [payload.roleName], // Use the actual role from payload
      features: payload.features || [],
      isSupervisor: payload.roleName === 'supervisor', // Explicitly set supervisor status
      supervisorInfo: payload.supervisorInfo || null, // Include supervisor info if available
    };
  }
}
