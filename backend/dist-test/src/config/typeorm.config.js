"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeOrmConfig = typeOrmConfig;
function typeOrmConfig(config) {
    return {
        type: 'postgres',
        host: config.getOrThrow('DATABASE_HOST'),
        port: config.get('DATABASE_PORT', 5432),
        username: config.getOrThrow('DATABASE_USER'),
        password: config.getOrThrow('DATABASE_PASSWORD'),
        database: config.getOrThrow('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: ['dist/database/migrations/*.js'],
        ssl: config.get('DATABASE_SSL') === 'true',
    };
}
