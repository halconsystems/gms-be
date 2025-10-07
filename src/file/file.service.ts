import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { FileUploadDto } from './dto/upload-file.dto';
import * as Papa from 'papaparse';
import { GuardUploadDto } from './dto/guard-upload.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FileService {
  private readonly s3: S3Client;

  constructor(private readonly prisma: PrismaService) {
    if (!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_KEY) {
      throw new InternalServerErrorException('AWS credentials not configured');
    }

    const config: S3ClientConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
      maxAttempts: 3,
    };

    this.s3 = new S3Client(config);
  }

  async getPresignedUrl(dto: FileUploadDto) {
    try {
      const bucketName = process.env.AWS_S3_BUCKET || 'guardsos-bucket-2025';
      if (!bucketName) {
        throw new Error('AWS S3 bucket name is not configured');
      }

      // Sanitize filename and create unique key
      const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `uploads/${Date.now()}-${sanitizedFileName}`;

      console.log('Generating presigned URL for:', {
        bucket: bucketName,
        key: key,
        contentType: dto.fileType,
      });

      const params: PutObjectCommandInput = {
        Bucket: bucketName,
        Key: key,
        ContentType: dto.fileType,
      };

      const command = new PutObjectCommand(params);
      const uploadUrl = await getSignedUrl(this.s3, command, {
        expiresIn: 3600, // 1 hour expiration
      });

      console.log('Generated presigned URL successfully');
      return { uploadUrl, key };
    } catch (error) {
      console.error('Failed to generate S3 presigned URL:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate upload URL: ${error.message}`);
      }
      throw new Error('Failed to generate upload URL');
    }
  }

  async getSecureDownloadUrl(key: string): Promise<string> {
    const bucketName = process.env.AWS_S3_BUCKET || 'guardsos-bucket-2025';
    if (!bucketName) {
      throw new Error('AWS S3 bucket name is not configured');
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3, command, { expiresIn: 1240 });
  }

  async parseCSV(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const csvString = buffer.toString();
      Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  async uploadGuards(organizationId: string, officeId: string, buffer: Buffer) {
    try {
      const guardsList = await this.parseCSV(buffer);
      
      console.log('Parsed CSV data:', guardsList); // Log parsed data
      
      const validatedGuards: GuardUploadDto[] = [];
      const errorsList: any[] = [];

      for (const [index, guardData] of guardsList.entries()) {
        console.log(`Validating guard at row ${index + 1}:`, guardData); // Log each guard data
        
        const guardDto = plainToInstance(GuardUploadDto, guardData);
        const errors = await validate(guardDto);

        if (errors.length > 0) {
          console.log(`Validation errors for row ${index + 1}:`, errors); // Log validation errors
          errorsList.push({
            row: index + 1,
            guardData, // Include the original data
            errors: errors.map((e) => ({
              property: e.property,
              constraints: e.constraints,
            })),
          });
        } else {
          validatedGuards.push({
            ...guardDto,
          });
        }
      }

      console.log('Total guards to create:', validatedGuards.length); // Log number of valid guards
      
      if (errorsList.length > 0) {
        console.log('Validation errors found:', errorsList); // Log all validation errors
        return { success: false, errors: errorsList };
      }

      const createGuardsDto = validatedGuards.map((guard) => {
        const {
          referenceName,
          referenceFatherName,
          referenceCnicNumber,
          ...rest
        } = guard;

        return {
          ...rest,
          organizationId,
          officeId: officeId['officeId'],
          serviceNumber: Number(guard.serviceNumber),
          height: Number(guard.height),
          dateOfBirth: new Date(guard.dateOfBirth).toISOString(),
          cnicIssueDate: new Date(guard.cnicIssueDate).toISOString(),
          cnicExpiryDate: new Date(guard.cnicExpiryDate).toISOString(),
          references: [
            {
              fullName: referenceName,
              fatherName: referenceFatherName,
              cnicNumber: referenceCnicNumber,
            },
          ],
        };
      });

      const createdGuards = await Promise.all(
        createGuardsDto.map((g) =>
          this.prisma.guard.create({
            data: {
              ...g,
              references: {
                create: g.references,
              },
            },
          }),
        ),
      );

      console.log('Guards created:', createdGuards.length); // Log successful creations
      return {
        success: true,
        message: `${createdGuards.length} guards created successfully.`,
        data: createdGuards,
      };
    } catch (error) {
      console.error('Error creating guards:', error); // Log creation errors
      if (error.code === 'P2002') {
        return {
          success: false,
          message: 'Duplicate service number or CNIC found. Please check your data.',
          error: error.meta
        };
      }
      handlePrismaError(error);
    }
  }
}