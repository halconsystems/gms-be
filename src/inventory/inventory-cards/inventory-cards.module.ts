import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InventoryCardsService } from './inventory-cards.service';
import { InventoryCardsController } from './inventory-cards.controller';

@Module({
  providers: [InventoryCardsService, PrismaService],
  controllers: [InventoryCardsController],
  exports: [InventoryCardsService],
})
export class InventoryCardsModule {}
