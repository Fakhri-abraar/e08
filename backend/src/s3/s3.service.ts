import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly BUCKET_NAME: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
    
    // Ambil Endpoint dari .env (Penting untuk MinIO)
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');

    if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('AWS S3 environment variables are not properly set.');
    }

    this.BUCKET_NAME = bucketName;

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // ▼▼▼ KONFIGURASI KHUSUS MINIO ▼▼▼
      endpoint: endpoint,       // URL Server MinIO (misal: http://127.0.0.1:9000)
      forcePathStyle: true,     // WAJIB TRUE untuk MinIO agar URL valid
      // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    });
  }

  async generatePresignedUrl(
    fileExtension: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; imagePath: string }> {
    // Buat nama file unik
    const imagePath = `posts/${randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.BUCKET_NAME,
      Key: imagePath,
      ContentType: contentType,
    });

    // Generate presigned URL yang valid selama 1 jam
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return { uploadUrl, imagePath };
  }
}