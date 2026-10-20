import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class AdvancedQueryLogger implements TypeOrmLogger {
  private readonly logger = new Logger('QueryLogger');

  logQuery(query: string, _parameters?: unknown[], _queryRunner?: QueryRunner) {
    if (process.env.NODE_ENV !== 'production') {
      if (_queryRunner && _queryRunner.data && typeof _queryRunner.data.request === 'object') {
        const req = _queryRunner.data.request as { queryCount?: number };
        req.queryCount = (req.queryCount || 0) + 1;
        if (req.queryCount > 5) {
          this.logger.warn(
            `N+1 Query Alert: Query count exceeded 5 (${req.queryCount}) for request. Query: ${query}`,
          );
        }
      }
    }
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ) {
    this.logger.error(
      `Query Error: ${error} -- Query: ${query} -- Parameters: ${JSON.stringify(parameters)}`,
    );
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ) {
    this.logger.warn(
      `Slow Query (${time}ms): ${query} -- Parameters: ${JSON.stringify(parameters)}`,
    );
  }

  logSchemaBuild(_message: string, _queryRunner?: QueryRunner) {}
  logMigration(_message: string, _queryRunner?: QueryRunner) {}
  log(_level: 'log' | 'info' | 'warn', _message: unknown, _queryRunner?: QueryRunner) {}
}
