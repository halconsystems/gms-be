import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GrnService } from './grn.service';
import { GrnController } from './grn.controller';

@Module({
  providers: [GrnService, PrismaService],
  controllers: [GrnController],
  exports: [GrnService],
})
export class GrnModule {}
