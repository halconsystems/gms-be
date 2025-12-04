import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BiometricService } from './biometric.service';
import { BiometricConfigService } from './biometric-config.service';
import { BiometricController } from './biometric.controller';
import { FileModule } from 'src/file/file.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    FileModule,
  ],
  providers: [BiometricService, BiometricConfigService, PrismaService],
  controllers: [BiometricController],
})
export class BiometricModule {}
