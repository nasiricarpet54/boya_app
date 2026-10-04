"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv_1 = require("dotenv");
const node_path_1 = require("node:path");
const typeorm_1 = require("typeorm");
(0, dotenv_1.config)({ path: (0, node_path_1.resolve)(__dirname, '../../.env') });
const host = process.env.DATABASE_MIGRATION_HOST ?? process.env.DATABASE_HOST ?? 'localhost';
const port = Number(process.env.DATABASE_MIGRATION_PORT ?? process.env.DATABASE_PORT ?? 5432);
const username = process.env.DATABASE_MIGRATION_USER ?? process.env.DATABASE_USER ?? 'beauty';
const password = process.env.DATABASE_MIGRATION_PASSWORD ?? process.env.DATABASE_PASSWORD ?? '';
const database = process.env.DATABASE_MIGRATION_NAME ?? process.env.DATABASE_NAME ?? 'beauty_platform';
if (username === 'beauty_app') {
    throw new Error('[migration DataSource] Loaded DATABASE_USER=beauty_app. ' +
        'Migrations must run as the master user. Check that backend/.env ' +
        'exists and DATABASE_MIGRATION_USER is set.');
}
console.log(`[migration DataSource] connecting as ${username}@${host}:${port}/${database}`);
exports.default = new typeorm_1.DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    synchronize: false,
    entities: ['src/**/*.entity.ts'],
    migrations: ['src/database/migrations/*.ts'],
    migrationsTableName: 'migrations',
});
