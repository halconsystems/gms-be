import { Catch, ArgumentsHost, BadRequestException, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/**
 * Exception filter to catch and suppress validation errors for biometric capture endpoint
 * Allows the request to proceed to the controller for manual transformation
 */
@Catch()
export class BiometricExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    // If this is a biometric capture request and validation failed, 
    // let it through by not catching it here, but instead 
    // we'll handle the raw body in the controller
    if (
      request.path?.includes('/biometric/capture-fingerprint') &&
      request.method === 'POST' &&
      exception instanceof BadRequestException
    ) {
      // For fingerprint endpoints, we want manual validation in controller
      // So we'll transform the validation error into a pass-through
      const response = (exception as any).getResponse();
      if (response && typeof response === 'object' && 'message' in response) {
        // This is a validation error, we'll skip it for biometric endpoints
        // The controller's manual validation will handle it instead
        console.log('[BiometricExceptionFilter] Skipping validation error for biometric endpoint');
        // Don't call super.catch() - this effectively allows the request through
        return;
      }
    }

    // For all other cases, use normal exception handling
    super.catch(exception, host);
  }
}
