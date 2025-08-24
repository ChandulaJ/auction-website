import {
  BadRequestError,
  ListingStatus,
  NotFoundError,
  requireAuth,
  validateRequest,
} from '@jjmauction/common';
import express, { Request, Response } from 'express';
import { body } from 'express-validator';

import { PaymentCreatedPublisher } from '../events/publishers/payment-created-publisher';
import { Listing, Payment } from '../models';
import { natsWrapper } from '../nats-wrapper';
import { stripe } from '../stripe-circuit-breaker';

const router = express.Router();

router.post(
  '/api/payments',
  requireAuth,
  [body('token').not().isEmpty(), body('listingId').not().isEmpty()],
  validateRequest,
  async (req: Request, res: Response) => {
    const { token, listingId } = req.body;

    const listing = await Listing.findOne({ where: { id: listingId } });

    if (!listing) {
      throw new NotFoundError();
    }

    if (listing.status !== ListingStatus.AwaitingPayment) {
      throw new BadRequestError(
        'You can only pay for listings that are sold and awaiting payment'
      );
    }

    if (listing.winnerId !== req.currentUser!.id) {
      throw new BadRequestError(
        'Only auction winners can pay for sold listings'
      );
    }

    try {
      console.log(`[Payment Service] Creating charge for listing ${listing.id}, amount: ${listing.amount}`);
      
      const charge = await stripe.createCharge({
        currency: 'usd',
        amount: listing.amount,
        source: token,
        description: `Payment for auction listing ${listing.id}`,
        metadata: {
          listingId: listing.id!,
          userId: req.currentUser!.id
        }
      });

      console.log(`[Payment Service] Stripe charge successful: ${charge.id}`);

      const payment = await Payment.create({
        listingId: listing.id!,
        stripeId: charge.id,
      });

      await new PaymentCreatedPublisher(natsWrapper.client).publish({
        id: listing.id!,
        version: payment.version!,
      });

      console.log(`[Payment Service] Payment record created: ${payment.id}`);
      res.status(201).send({ id: payment.id, chargeId: charge.id });
      
    } catch (error: any) {
      console.error('[Payment Service] Payment processing failed:', error.message);
      
      // Handle circuit breaker errors specifically
      if (error.name === 'CircuitBreakerError') {
        throw new BadRequestError(
          'Payment processing is temporarily unavailable. Please try again in a few minutes.'
        );
      }
      
      // Handle Stripe-specific errors
      if (error.name === 'StripeChargeError') {
        throw new BadRequestError(
          `Payment failed: ${error.message}. Please check your payment details and try again.`
        );
      }
      
      // Generic error fallback
      throw new BadRequestError(
        'Payment processing failed. Please try again later.'
      );
    }
  }
);

export { router as createPaymentRouter };
