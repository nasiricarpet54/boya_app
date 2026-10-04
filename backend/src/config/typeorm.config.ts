import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function typeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DATABASE_HOST'),
    port: config.get<number>('DATABASE_PORT', 5432),
    username: config.getOrThrow<string>('DATABASE_USER'),
    password: config.getOrThrow<string>('DATABASE_PASSWORD'),
    database: config.getOrThrow<string>('DATABASE_NAME'),
    autoLoadEntities: true,
    synchronize: false,
    migrations: ['dist/database/migrations/*.js'],
    ssl: config.get<string>('DATABASE_SSL') === 'true',
  };
}
