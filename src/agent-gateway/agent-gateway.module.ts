import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { AgentGatewayService } from './agent-gateway.service';

@Module({
  imports: [FileModule],
  providers: [AgentGatewayService],
  exports: [AgentGatewayService],
})
export class AgentGatewayModule {}
