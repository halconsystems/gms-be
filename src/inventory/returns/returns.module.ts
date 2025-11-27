import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';

@Module({
  providers: [ReturnsService, PrismaService],
  controllers: [ReturnsController],
  exports: [ReturnsService],
})
export class ReturnsModule {}
