import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GeneratePresignedUrlDto } from './dto/generate-presigned-url.dto';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post('presigned-url')
  @UseGuards(JwtAuthGuard)
  async generatePresignedUrl(@Body() dto: GeneratePresignedUrlDto) { // <--- Tambahkan async
    // TODO
    // Panggil service dengan data dari DTO
    return this.s3Service.generatePresignedUrl(
      dto.fileExtension,
      dto.contentType,
    );
    // --- Akhir TODO ---
  }
}