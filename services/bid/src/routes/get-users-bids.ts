import { requireAuth } from '@auction-platform/common';
import express, { Request, Response } from 'express';

import { Bid } from '../models';

const router = express.Router();

router.get('/api/bids', requireAuth, async (req: Request, res: Response) => {
  const bids = await Bid.findAll({
    include: [{ all: true }],
    where: { userId: req.currentUser!.id },
  });

  res.status(200).send(bids);
});

export { router as getUserBidsRouter };
