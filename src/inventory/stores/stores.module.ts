import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';

@Module({
  providers: [StoresService, PrismaService],
  controllers: [StoresController],
  exports: [StoresService],
})
export class StoresModule {}
