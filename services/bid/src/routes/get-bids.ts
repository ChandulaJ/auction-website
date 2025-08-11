import { currentUser } from '@auction-platform/common';
import express, { Request, Response } from 'express';

const router = express.Router();

router.get(
  '/api/bids/:orderId',
  currentUser,
  (req: Request, res: Response) => {}
);

export { router as getBidsRouter };
