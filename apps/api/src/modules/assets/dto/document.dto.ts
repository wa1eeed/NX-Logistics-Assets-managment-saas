import { IsOptional, IsString, MinLength } from 'class-validator';

export class UploadDocumentDto {
  @IsString() @MinLength(2)
  docType!: string;

  @IsOptional() @IsString()
  expiryDate?: string;
}
