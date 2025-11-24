import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BiometricService } from './biometric.service';
import { BiometricController } from './biometric.controller';
import { FileModule } from 'src/file/file.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    FileModule,
  ],
  providers: [BiometricService],
  controllers: [BiometricController],
})
export class BiometricModule {}
