import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/** Shared Redis-backed application cache used by feature modules. */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheServiceModule {}
