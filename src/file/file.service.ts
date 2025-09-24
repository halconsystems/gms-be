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
