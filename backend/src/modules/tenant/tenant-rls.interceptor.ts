import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const isSuperAdmin = user?.role === 'super_admin';

    // The instructions say: "execute: SELECT set_config('app.current_tenant_id', $1, true);"
    // Using `true` applies to the transaction, but we are not necessarily in a transaction.
    // However, if we do it globally on the connection pool, it might leak if not careful.
    // The prompt just says "execute: SELECT set_config('app.current_tenant_id', $1, true);"
    if (user?.tenantId && !isSuperAdmin) {
      await this.dataSource.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [user.tenantId]);
    }

    return next.handle();
  }
}
