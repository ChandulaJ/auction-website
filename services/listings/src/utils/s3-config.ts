import { S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';

// Validate AWS credentials
const getAWSCredentials = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId) {
    throw new Error('AWS_ACCESS_KEY_ID environment variable is required');
  }
  if (!secretAccessKey) {
    throw new Error('AWS_SECRET_ACCESS_KEY environment variable is required');
  }
  return { accessKeyId, secretAccessKey };
};

// Configure AWS SDK v3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: getAWSCredentials(),
});

// Get bucket name with validation
const getBucketName = (): string => {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
  }
  return bucketName;
};

// Configure multer for S3 upload with AWS SDK v3
const uploadToS3 = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: getBucketName(),
    // Removed ACL since the bucket doesn't allow ACLs
    // Files will inherit bucket's public access policy
    key: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `listings/${uniqueSuffix}-${file.originalname}`);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Function to generate different sized image URLs for S3
const generateImageUrls = (
  key: string,
  bucketName: string
): {
  original: string;
  small: string;
  large: string;
} => {
  const baseUrl = `https://${bucketName}.s3.${
    process.env.AWS_REGION || 'us-east-1'
  }.amazonaws.com/${key}`;

  // For simplicity, we'll use the same image for different sizes
  // In a production environment, you might want to use AWS Lambda or CloudFront
  // with image transformation capabilities
  return {
    original: baseUrl,
    small: baseUrl, // 225x225 equivalent
    large: baseUrl, // 1280x1280 equivalent
  };
};

export { generateImageUrls, s3Client, uploadToS3 };
