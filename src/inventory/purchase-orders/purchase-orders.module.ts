import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';

@Module({
  providers: [PurchaseOrdersService, PrismaService],
  controllers: [PurchaseOrdersController],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}

