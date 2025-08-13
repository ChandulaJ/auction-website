import {
  BadRequestError,
  requireAuth,
  validateRequest,
} from '@jjmauction/common';
import express, { Request, Response } from 'express';
import { body } from 'express-validator';

import { ListingCreatedPublisher } from '../events/publishers/listing-created-publisher';
import { Listing, db } from '../models';
import { natsWrapper } from '../nats-wrapper';
import { generateImageUrls, uploadToS3 } from '../utils/s3-config';

// Define S3 file interface
interface S3File extends Express.Multer.File {
  key: string;
  location: string;
  bucket: string;
}

// Extend Request interface to include file property for S3
interface MulterS3Request extends Request {
  file: S3File;
}

const router = express.Router();

router.post(
  '/api/listings',
  uploadToS3.single('image'),
  requireAuth,
  [
    body('price')
      .isNumeric()
      .withMessage('Invalid value')
      .custom((value) => {
        const price = parseFloat(value);
        if (isNaN(price) || price <= 0) {
          throw new Error('Invalid value');
        }
        // Check for reasonable upper limit (max $999,999.99 = 99,999,999 cents)
        if (price > 999999.99) {
          throw new Error('Invalid value');
        }
        return true;
      }),
    body('title')
      .notEmpty()
      .withMessage('The listing title must be between 5 and 1000 characters')
      .isLength({ min: 5, max: 1000 })
      .withMessage('The listing title must be between 5 and 1000 characters')
      .trim(),
    body('expiresAt')
      .notEmpty()
      .withMessage('Invalid Date')
      .custom((value) => {
        const enteredDate = new Date(value);
        const tommorowsDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        if (isNaN(enteredDate.getTime()) || enteredDate <= tommorowsDate) {
          throw new Error('Invalid Date');
        }
        return true;
      }),
    body('description')
      .notEmpty()
      .withMessage(
        'The listing description must be between 5 and 500 characters'
      )
      .isLength({ min: 5, max: 500 })
      .withMessage(
        'The listing description must be between 5 and 500 characters'
      )
      .trim(),
  ],
  validateRequest,
  async (req: MulterS3Request, res: Response) => {
    // Debug logging
    console.log('Request body:', req.body);
    console.log('Price value:', req.body.price, 'Type:', typeof req.body.price);
    console.log(
      'Title value:',
      req.body.title,
      'Length:',
      req.body.title?.length
    );
    console.log(
      'Description value:',
      req.body.description,
      'Length:',
      req.body.description?.length
    );
    
    await db.transaction(async (transaction) => {
      const { price, title, description, expiresAt } = req.body;

      // Get S3 file information from multer-s3
      const uploadedFile = req.file;
      if (!uploadedFile) {
        throw new BadRequestError('Image file is required');
      }

      // Generate image URLs from S3 location
      const bucketName = process.env.AWS_S3_BUCKET_NAME;
      if (!bucketName) {
        throw new BadRequestError('S3 bucket not configured');
      }
      
      const imageUrls = generateImageUrls(uploadedFile.key, bucketName);

      const listing = await Listing.create(
        {
          userId: req.currentUser.id,
          startPrice: price,
          currentPrice: price,
          title,
          description,
          expiresAt,
          imageId: uploadedFile.key,
          smallImage: imageUrls.small,
          largeImage: imageUrls.large,
        },
        { transaction }
      );

      new ListingCreatedPublisher(natsWrapper.client).publish({
        id: listing.id,
        userId: req.currentUser.id,
        slug: listing.slug,
        title,
        price,
        expiresAt,
        version: listing.version,
      });

      res.status(201).send(listing);
    });
  }
);

export { router as createListingRouter };
