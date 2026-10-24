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

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const isSuperAdmin = user?.role === 'super_admin';

    // Tenant isolation is NOT enforced here. Every tenant-scoped service opens
    // its own transaction and calls setTenantContext() (set_config(..., true)),
    // which is the only form that cannot leak onto a pooled connection. This
    // hook only mirrors the tenant id for the few statements that run outside
    // such a transaction.
    //
    // Known gap (see docs/report audit): `false` writes the GUC at *session*
    // level, so the value survives on the pooled connection after the response
    // and can be read by a later request that reuses that connection. That is
    // why the isolation spec asserts on service-level transactions, not on this
    // interceptor.
    if (user?.tenantId && !isSuperAdmin) {
      await this.dataSource.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [user.tenantId]);
    }

    if (user?.id) {
      await this.dataSource.query(`SELECT set_config('app.current_user_id', $1, false)`, [user.id]);
    }

    if (user?.role) {
      await this.dataSource.query(`SELECT set_config('app.current_role', $1, false)`, [user.role]);
    }

    return next.handle();
  }
}
