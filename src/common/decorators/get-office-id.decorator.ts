import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const GetOfficeId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request || !request.user) {
      throw new UnauthorizedException('User not found in request');
    }

    // officeId may be undefined for superAdmin or users without an assigned office
    const officeId = request.user.officeId;
    return officeId;
  },
);
