import { Module, forwardRef } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { UserService } from 'src/user/user.service';
import { Roles } from 'src/common/decorators/role.decorator';
import { RoleService } from 'src/role/role.service';
import { GuardModule } from 'src/guard/guard.module';
import { FileService } from 'src/file/file.service';

@Module({
  imports: [forwardRef(() => GuardModule)],
  providers: [EmployeeService, UserService, RoleService, FileService],
  controllers: [EmployeeController],
  exports: [EmployeeService],
})
export class EmployeeModule {}
