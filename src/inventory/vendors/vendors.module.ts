import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';

@Module({
  providers: [VendorsService, PrismaService],
  controllers: [VendorsController],
  exports: [VendorsService],
})
export class VendorsModule {}
