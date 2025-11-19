import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import { S3Module } from './s3/s3.module';
import { ConfigModule } from '@nestjs/config'; // <-- 1. Impor

@Module({
  imports: [
    PostsModule,
    AuthModule,
    S3Module,
    ConfigModule.forRoot({ // <-- 2. Tambahkan ini
      isGlobal: true,      // Membuatnya tersedia di semua modul
      envFilePath: '.env', // Pastikan file .env ada di folder backend
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}