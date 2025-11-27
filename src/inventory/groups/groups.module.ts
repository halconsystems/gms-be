import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';

@Module({
  providers: [GroupsService, PrismaService],
  controllers: [GroupsController],
  exports: [GroupsService],
})
export class GroupsModule {}
