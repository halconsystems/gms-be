import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StockMovementsService } from './stock-movements.service';
import { StockMovementsController } from './stock-movements.controller';

@Module({
  providers: [StockMovementsService, PrismaService],
  controllers: [StockMovementsController],
  exports: [StockMovementsService],
})
export class StockMovementsModule {}
