import { createParamDecorator, ExecutionContext, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export const GetClientId = createParamDecorator(
    async (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new UnauthorizedException('User not authenticated');
        }

        // Get PrismaService instance from request (set by PrismaMiddleware)
        const prisma: PrismaService = request.prisma;
        if (!prisma) {
            throw new Error('PrismaService not available in request context');
        }

        const client = await prisma.client.findFirst({
            where: { userId: user.id }
        });

        if (!client) {
            throw new NotFoundException('No client record found for this user');
        }

        return client.id;
    }
);