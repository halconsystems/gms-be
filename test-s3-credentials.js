const { S3Client, ListBucketsCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const testS3Credentials = async () => {
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

  try {
    console.log('🔍 Testing S3 Credentials...\n');
    console.log('Configuration:');
    console.log(`  Region: ${process.env.AWS_REGION}`);
    console.log(`  Access Key: ${process.env.AWS_ACCESS_KEY?.substring(0, 10)}...`);
    console.log(`  Bucket: ${process.env.S3_BUCKET_NAME}\n`);

    // Test 1: List all buckets
    console.log('Test 1: Listing all S3 buckets...');
    const listBucketsCommand = new ListBucketsCommand({});
    const bucketsResponse = await s3Client.send(listBucketsCommand);
    console.log('✅ Successfully listed buckets:');
    bucketsResponse.Buckets.forEach((bucket) => {
      console.log(`   - ${bucket.Name}`);
    });

    // Test 2: Check specific bucket access
    console.log(`\nTest 2: Checking access to bucket "${process.env.S3_BUCKET_NAME}"...`);
    const headBucketCommand = new HeadBucketCommand({
      Bucket: process.env.S3_BUCKET_NAME,
    });
    await s3Client.send(headBucketCommand);
    console.log(`✅ Successfully accessed bucket: ${process.env.S3_BUCKET_NAME}`);

    console.log('\n✅ All tests passed! S3 credentials are working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.Code === 'InvalidAccessKeyId') {
      console.error('   → Invalid AWS Access Key ID');
    } else if (error.Code === 'SignatureDoesNotMatch') {
      console.error('   → Invalid AWS Secret Access Key');
    } else if (error.Code === 'NoSuchBucket') {
      console.error(`   → Bucket "${process.env.S3_BUCKET_NAME}" does not exist`);
    } else if (error.Code === 'AccessDenied') {
      console.error(`   → Access denied to bucket "${process.env.S3_BUCKET_NAME}"`);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
};

testS3Credentials();
