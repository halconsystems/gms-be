import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';

@Module({
  providers: [ItemsService, PrismaService],
  controllers: [ItemsController],
  exports: [ItemsService],
})
export class ItemsModule {}
