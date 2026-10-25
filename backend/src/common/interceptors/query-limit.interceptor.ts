import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor to track database queries and enforce max limit of 5 queries per request.
 * Prevents N+1 query problems and excessive database calls.
 */
@Injectable()
export class QueryLimitInterceptor implements NestInterceptor {
    private static readonly MAX_QUERIES = 5;
    private static queryCounter = new Map<string, number>();
    private static logger = new Logger('QueryLimitInterceptor');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const requestId = request.id || request.ip || request.socket.remoteAddress;
        
        // Reset counter for this request
        QueryLimitInterceptor.queryCounter.set(requestId, 0);

        return next.handle().pipe(
            tap({
                next: () => {
                    const queryCount = QueryLimitInterceptor.queryCounter.get(requestId) || 0;
                    if (queryCount > QueryLimitInterceptor.MAX_QUERIES) {
                        QueryLimitInterceptor.logger.warn(
                            `High query count: ${queryCount} queries (max: ${QueryLimitInterceptor.MAX_QUERIES}) for ${request.originalUrl}`
                        );
                    } else {
                        QueryLimitInterceptor.logger.debug(
                            `Query count: ${queryCount} (max: ${QueryLimitInterceptor.MAX_QUERIES}) for ${request.originalUrl}`
                        );
                    }
                    QueryLimitInterceptor.queryCounter.delete(requestId);
                }
            })
        );
    }

    static recordQuery(): void {
        const request = this.getRequest();
        if (request) {
            const requestId = request.id || request.ip || request.socket?.remoteAddress;
            if (requestId) {
                const current = this.queryCounter.get(requestId) || 0;
                this.queryCounter.set(requestId, current + 1);
            }
        }
    }

    private static getRequest(): any {
        try {
            const { getRequestContext } = require('@nestjs/core');
            return getRequestContext();
        } catch {
            return undefined;
        }
    }
}
