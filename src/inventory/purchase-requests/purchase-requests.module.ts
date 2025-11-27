import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PurchaseRequestsService } from './purchase-requests.service';
import { PurchaseRequestsController } from './purchase-requests.controller';

@Module({
  providers: [PurchaseRequestsService, PrismaService],
  controllers: [PurchaseRequestsController],
  exports: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
