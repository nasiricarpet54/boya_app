import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { UPLOAD_DIR_DEFAULT } from './modules/upload/upload.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.use(compression());

  // Served at the host root — deliberately outside the `api/v1` prefix, so the
  // stored URLs (`/uploads/...`) resolve the same in dev, behind Caddy and in a
  // browser. The directory matches the one `UploadService` writes into.
  app.useStaticAssets(process.env.UPLOAD_DIR || UPLOAD_DIR_DEFAULT, {
    prefix: '/uploads/',
  });
  const corsOrigins =
    process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || ['*'];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, origin?: boolean | string | RegExp | (string | RegExp)[]) => void,
    ) => {
      // اگه origin خالیه (server-to-server)، قبول کن
      if (!origin) return callback(null, true);

      // localhost با هر پورتی — برای development (Flutter web dev)
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // دامنه‌های مجاز
      if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
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
