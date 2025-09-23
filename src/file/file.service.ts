import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { FileUploadDto } from './dto/upload-file.dto';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { CreateGuardDto } from 'src/guard/dto/create-guard-dto';
import { GuardUploadDto } from './dto/guard-upload.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from 'src/prisma/prisma.service';
import { off } from 'process';

@Injectable()
export class FileService {


  constructor(private readonly prisma : PrismaService){}


  private s3 = new S3Client({
    region: process.env.AWS_REGION || "",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY || "",
      secretAccessKey: process.env.AWS_SECRET_KEY || "",
    },
  });

  async getPresignedUrl(dto : FileUploadDto) {
    try {
        const bucketName = process.env.AWS_S3_BUCKET;
        const key = `uploads/${Date.now()}-${dto.fileName}`;

        const params: PutObjectCommandInput = {
        Bucket: bucketName,
        Key: key,
        ContentType: dto.fileType,
        };

        const command = new PutObjectCommand(params);
        const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 1240 });

        // const fileUrl = `https://${bucketName}.s3.amazonaws.com/${key}`;
        return { uploadUrl, key };
    } catch (error) {
        console.error('S3 upload error:', error);
        handlePrismaError(error);
    }
  }


  async getSecureDownloadUrl(key: string): Promise<string> {
    const bucketName = process.env.AWS_S3_BUCKET;
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3, command, { expiresIn: 1240 }); 
  }


  async parseCSV(buffer: Buffer): Promise<any[]> {
    const results: any[] = [];

    return new Promise((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  }


  async uploadGuards(organizationId : string, officeId : string , buffer: Buffer){
    try {
      const guardsList = await this.parseCSV(buffer); 

      const validatedGuards: GuardUploadDto[] = [];
      const errorsList : any[] = [];

      for (const [index, guardData] of guardsList.entries()) {
        const guardDto = plainToInstance(GuardUploadDto, guardData);
        const errors = await validate(guardDto);

        if (errors.length > 0) {
          errorsList.push({
            row: index + 1,
            errors: errors.map(e => ({
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

      if (errorsList.length > 0) {
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
            officeId : officeId["officeId"],
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

        // return createGuardsDto;

        const createdGuards =  await Promise.all(
          createGuardsDto.map((g) =>
              this.prisma.guard.create({
                data: {
                  ...g,
                  references: {
                    create:  g.references, 
                  },
                },
              })
            )
          );
  

        return {
          success: true,
          message: `${createdGuards.length} guards created successfully.`,
          data: createdGuards,
        };
      
    } catch (error) {
     handlePrismaError(error) 
    }
  }
}
