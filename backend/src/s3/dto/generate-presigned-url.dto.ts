import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class GeneratePresignedUrlDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'File extension must contain only alphanumeric characters',
  })
  fileExtension: string;

  @IsNotEmpty()
  @IsString()
  contentType: string;
}
