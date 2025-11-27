import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  providers: [InventoryService, PrismaService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
