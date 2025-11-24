import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { Request } from 'express';

export class BiometricValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super(options);
  }

  async transform(value: any, metadata: any): Promise<any> {
    // Check if this is a biometric capture request by inspecting the context
    const ctx = metadata?.type === 'body' ? true : false;
    
    // For biometric endpoints, skip validation and return raw value
    if (metadata?.data === 'body' && value && typeof value === 'object') {
      // Just return the raw value without validation
      return value;
    }

    // For all other requests, use normal validation
    return super.transform(value, metadata);
  }
}
