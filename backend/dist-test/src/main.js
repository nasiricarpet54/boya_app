"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    const prefix = config.get('API_PREFIX', 'api/v1');
    app.setGlobalPrefix(prefix);
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const isDev = nodeEnv !== 'production';
    app.enableCors({
        origin: isDev
            ? (origin, callback) => {
                if (!origin ||
                    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                    callback(null, true);
                }
                else {
                    callback(null, false);
                }
            }
            : (process.env.CORS_ORIGINS ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Accept',
            'X-Requested-With',
        ],
        maxAge: 86400,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const swagger = new swagger_1.DocumentBuilder()
        .setTitle('Beauty Platform API')
        .setDescription('Multi-tenant beauty services marketplace')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    swagger_1.SwaggerModule.setup('docs', app, swagger_1.SwaggerModule.createDocument(app, swagger));
    const port = config.get('PORT', 3000);
    await app.listen(port);
}
void bootstrap();
