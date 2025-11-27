import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { IssuancesService } from './issuances.service';
import { IssuancesController } from './issuances.controller';

@Module({
  providers: [IssuancesService, PrismaService],
  controllers: [IssuancesController],
  exports: [IssuancesService],
})
export class IssuancesModule {}
