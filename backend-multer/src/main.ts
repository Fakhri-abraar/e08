import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path'; // <-- Impor 'join'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  // TODO
  // Implementasi Static Assets (sesuai app.e2e-spec.ts)
  // Ini akan menyajikan file dari folder 'uploads' di root proyek
  // di bawah prefix URL '/uploads/'
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  // --- Akhir TODO ---

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: false,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();