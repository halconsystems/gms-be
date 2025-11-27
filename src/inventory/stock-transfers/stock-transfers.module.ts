import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StockTransfersService } from './stock-transfers.service';
import { StockTransfersController } from './stock-transfers.controller';

@Module({
  providers: [StockTransfersService, PrismaService],
  controllers: [StockTransfersController],
  exports: [StockTransfersService],
})
export class StockTransfersModule {}
