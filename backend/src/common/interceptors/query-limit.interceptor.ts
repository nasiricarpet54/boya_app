import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  OnModuleInit,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';

const QUERY_COUNT_KEY = 'boya:queryCount';

/**
 * Per-request database round-trip budget, the N+1 guard for the public salon
 * catalogue (`GET /salons`, `GET /salons/:id`, `match`, ...): a request may
 * issue at most [MAX_QUERIES] `DataSource.query()` calls.
 *
 * Counting rides on the request-scoped context `ClsModule` already mounts and
 * on the one funnel every raw read already goes through — no per-call-site
 * instrumentation. The interceptor resets the counter as the request enters and
 * logs the final count, warning when the budget is blown.
 */
@Injectable()
export class QueryLimitInterceptor implements NestInterceptor, OnModuleInit {
  static readonly MAX_QUERIES = 5;

  private static readonly logger = new Logger('QueryLimitInterceptor');

  constructor(
    private readonly dataSource: DataSource,
    private readonly cls: ClsService,
  ) {}

  /**
   * shortcut: only `DataSource.query` is counted — TypeORM query-builder and
   * `manager.query` calls bypass it; instrument `QueryRunner.query` too if the
   * catalogue ever moves off raw SQL.
   */
  onModuleInit(): void {
    const original = this.dataSource.query.bind(this.dataSource) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    const counted = this.dataSource as unknown as {
      query: (...args: unknown[]) => Promise<unknown>;
    };
    counted.query = (...args: unknown[]) => {
      if (this.cls.isActive()) {
        this.cls.set(
          QUERY_COUNT_KEY,
          (this.cls.get<number>(QUERY_COUNT_KEY) ?? 0) + 1,
        );
      }
      return original(...args);
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // The CLS middleware runs before interceptors, so a context is always live
    // here; the RLS interceptor's own `set_config` stays outside this counter.
    this.cls.set(QUERY_COUNT_KEY, 0);
    const url = context.switchToHttp().getRequest().originalUrl as string;

    return next.handle().pipe(
      tap({
        next: () => this.report(url),
        // Counted even on failure, otherwise a blown budget could hide behind
        // a 500.
        error: () => this.report(url),
      }),
    );
  }

  private report(url: string): void {
    const count = this.cls.get<number>(QUERY_COUNT_KEY) ?? 0;
    if (count > QueryLimitInterceptor.MAX_QUERIES) {
      QueryLimitInterceptor.logger.warn(
        `High query count: ${count} queries (max: ${QueryLimitInterceptor.MAX_QUERIES}) for ${url}`,
      );
    } else {
      QueryLimitInterceptor.logger.debug(
        `Query count: ${count} (max: ${QueryLimitInterceptor.MAX_QUERIES}) for ${url}`,
      );
    }
  }
}
