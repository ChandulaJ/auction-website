import 'express-async-errors';

import { NotFoundError, currentUser, errorHandler } from '@jjmauction/common';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import express from 'express';

import { createBidRouter } from './routes/create-bid';
import { deleteBidRouter } from './routes/delete-bid';
import { getBidsRouter } from './routes/get-bids';
import { getUserBidsRouter } from './routes/get-users-bids';
import { getListingsServiceHealth } from './utils/sync-listings';

const app = express();

app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({ signed: false, secure: false }));
app.use(currentUser);

// Health check endpoint with circuit breaker status
app.get('/health', (req, res) => {
  const listingsHealth = getListingsServiceHealth();
  
  res.status(listingsHealth.isHealthy ? 200 : 503).json({
    status: listingsHealth.isHealthy ? 'healthy' : 'degraded',
    service: 'bid',
    timestamp: new Date().toISOString(),
    dependencies: {
      listingsService: {
        isHealthy: listingsHealth.isHealthy,
        circuitBreaker: listingsHealth.stats
      }
    }
  });
});

app.use(deleteBidRouter);
app.use(createBidRouter);
app.use(getUserBidsRouter);
app.use(getBidsRouter);

app.all('*', () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
