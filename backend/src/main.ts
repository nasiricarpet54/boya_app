import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.use(compression());
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isDev = nodeEnv !== 'production';

  app.enableCors({
    origin: isDev
      ? (origin: string, callback: (err: Error | null, origin?: boolean | string | RegExp | (string | RegExp)[]) => void) => {
          // In dev: allow any localhost/127.0.0.1 origin (any port)
          if (
            !origin ||
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
          ) {
            callback(null, true);
          } else {
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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Beauty Platform API')
    .setDescription('Multi-tenant beauty services marketplace')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
