import { Module, forwardRef } from '@nestjs/common';
import { GuardService } from './guard.service';
import { GuardController } from './guard.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileService } from 'src/file/file.service';
import { EmployeeModule } from 'src/employee/employee.module';

@Module({
  imports: [forwardRef(() => EmployeeModule)],
  providers: [GuardService, PrismaService, FileService],
  controllers: [GuardController],
  exports: [GuardService]
})
export class GuardModule {}
