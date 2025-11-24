import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Don't wrap flat response format from agent services (already has success field)
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        
        // Wrap other responses with standard envelope
        return {
          status: 'success',
          message: this.getMessage(context),
          data,
        };
      }),
    );
  }

  private getMessage(context: ExecutionContext): string {
    const handler = context.getHandler();
    const customMessage = Reflect.getMetadata('custom:message', handler);
    return customMessage || 'Request successful';
  }
}
