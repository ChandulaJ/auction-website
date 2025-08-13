# AWS S3 Setup Guide for Auction Website

This guide explains how to set up AWS S3 for image uploads in the auction website.

## Prerequisites

- AWS Account
- AWS CLI installed (optional but recommended)
- Access to AWS Management Console

## Step 1: Create S3 Bucket

1. Log into AWS Management Console
2. Navigate to S3 service
3. Click "Create bucket"
4. Choose a unique bucket name (e.g., `auction-website-images-[your-unique-id]`)
5. Select your preferred region (e.g., `us-east-1`)
6. Configure bucket settings:
   - **Block Public Access**: Uncheck "Block all public access" 
   - **Bucket Versioning**: Enable (recommended)
   - **Tags**: Add tags as needed
7. Click "Create bucket"

## Step 2: Configure Bucket Policy

1. Select your bucket from the S3 console
2. Go to "Permissions" tab
3. Click "Bucket policy"
4. Add the following policy (replace `YOUR_BUCKET_NAME` with your actual bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        }
    ]
}
```

## Step 3: Create IAM User

1. Navigate to IAM service in AWS Console
2. Click "Users" → "Add user"
3. Set username (e.g., `auction-website-s3-user`)
4. Select "Programmatic access"
5. Click "Next: Permissions"
6. Choose "Attach existing policies directly"
7. Search and select `AmazonS3FullAccess` (or create a custom policy for specific bucket access)
8. Click through to create user
9. **Important**: Save the Access Key ID and Secret Access Key

## Step 4: Configure Environment Variables

Update your `.env.local` file with the S3 credentials:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your_bucket_name_here
```

## Step 5: Update Kubernetes Secrets (for production)

If deploying to Kubernetes, create the necessary secrets:

```bash
# Create AWS credentials secrets
kubectl create secret generic aws-access-key-id-secret --from-literal=AWS_ACCESS_KEY_ID=your_access_key_id
kubectl create secret generic aws-secret-access-key-secret --from-literal=AWS_SECRET_ACCESS_KEY=your_secret_access_key
kubectl create secret generic aws-region-secret --from-literal=AWS_REGION=us-east-1
kubectl create secret generic aws-s3-bucket-name-secret --from-literal=AWS_S3_BUCKET_NAME=your_bucket_name
```

## Step 6: Test Upload

1. Start the auction website services
2. Navigate to the create listing page
3. Try uploading an image
4. Verify the image appears in your S3 bucket

## Security Best Practices

1. **Use IAM Policies**: Create a custom IAM policy that only allows access to your specific bucket:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR_BUCKET_NAME/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR_BUCKET_NAME"
            ]
        }
    ]
}
```

2. **Enable MFA**: Enable Multi-Factor Authentication for your AWS account
3. **Rotate Keys**: Regularly rotate your access keys
4. **Monitor Usage**: Set up CloudTrail and CloudWatch for monitoring

## Troubleshooting

### Common Issues

1. **403 Forbidden Error**: Check bucket policy and IAM permissions
2. **Bucket Not Found**: Verify bucket name and region
3. **Access Denied**: Ensure IAM user has proper S3 permissions
4. **Images Not Loading**: Check if bucket policy allows public read access

### Useful AWS CLI Commands

```bash
# List buckets
aws s3 ls

# List objects in bucket
aws s3 ls s3://your-bucket-name

# Copy file to bucket (for testing)
aws s3 cp test-image.jpg s3://your-bucket-name/

# Check bucket policy
aws s3api get-bucket-policy --bucket your-bucket-name
```

## Cost Optimization

- Enable S3 Intelligent Tiering for automatic cost optimization
- Set up lifecycle policies to transition old images to cheaper storage classes
- Monitor S3 costs using AWS Cost Explorer

## Migration from Cloudinary

The application has been updated to use S3 instead of Cloudinary. Key changes:

1. **Image Upload**: Now uses `multer-s3` instead of Cloudinary upload
2. **Image URLs**: Direct S3 URLs instead of Cloudinary transformation URLs
3. **Image Processing**: Basic upload only (no automatic resizing)

For advanced image processing (resizing, optimization), consider:
- AWS Lambda with Sharp library
- CloudFront with Lambda@Edge
- Third-party services like ImageKit or Cloudinary (if you want to keep processing features)
