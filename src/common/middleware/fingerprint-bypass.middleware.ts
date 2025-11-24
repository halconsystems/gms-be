import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to bypass global validation pipe for fingerprint endpoints
 * Allows raw request body to reach controller for manual transformation
 */
@Injectable()
export class FingerprintBypassMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Mark requests for biometric capture to skip global validation
    if (req.path?.includes('/biometric/capture-fingerprint') && req.method === 'POST') {
      // Attach a flag that can be checked by the validation pipe
      (req as any).skipValidation = true;
    }
    next();
  }
}
