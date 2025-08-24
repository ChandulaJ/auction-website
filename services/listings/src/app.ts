import 'express-async-errors';

import { NotFoundError, currentUser, errorHandler } from '@jjmauction/common';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import express from 'express';

import { createListingRouter } from './routes/create-listing';
import { deleteListingRouter } from './routes/delete-listing';
import { getExpiredListingsRouter } from './routes/get-expired-listings';
import { getListingRouter } from './routes/get-listing';
import { getListingsRouter } from './routes/get-listings';
import { getSoldListingsRouter } from './routes/get-sold-listings';
import { getUserListingsRouter } from './routes/get-users-listings';
import { listingsDatabaseCircuitBreaker } from './utils/database-circuit-breaker';
import { listingsS3CircuitBreaker } from './utils/s3-circuit-breaker';

const app = express();

app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({ signed: false, secure: false }));
app.use(currentUser);

// Health check endpoint with circuit breaker status
app.get('/api/listings/health', async (req, res) => {
  const dbHealth = await listingsDatabaseCircuitBreaker.checkDatabaseHealth();
  const s3Health = await listingsS3CircuitBreaker.checkS3Health();
  const dbStats = listingsDatabaseCircuitBreaker.getStats();
  const s3Stats = listingsS3CircuitBreaker.getStats();
  
  const overallHealthy = dbHealth && s3Health && 
                        listingsDatabaseCircuitBreaker.isHealthy() && 
                        listingsS3CircuitBreaker.isHealthy();
  
  const health = {
    status: overallHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    service: 'listings',
    database: {
      healthy: dbHealth,
      circuitBreaker: dbStats
    },
    s3: {
      healthy: s3Health,
      circuitBreaker: s3Stats
    }
  };
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Circuit breaker management endpoints
app.post('/api/listings/circuit-breaker/database/trip', (req, res) => {
  listingsDatabaseCircuitBreaker.trip();
  res.json({ message: 'Listings database circuit breaker tripped', state: listingsDatabaseCircuitBreaker.getStats().state });
});

app.post('/api/listings/circuit-breaker/database/reset', (req, res) => {
  listingsDatabaseCircuitBreaker.forceReset();
  res.json({ message: 'Listings database circuit breaker reset', state: listingsDatabaseCircuitBreaker.getStats().state });
});

app.post('/api/listings/circuit-breaker/s3/trip', (req, res) => {
  listingsS3CircuitBreaker.trip();
  res.json({ message: 'Listings S3 circuit breaker tripped', state: listingsS3CircuitBreaker.getStats().state });
});

app.post('/api/listings/circuit-breaker/s3/reset', (req, res) => {
  listingsS3CircuitBreaker.forceReset();
  res.json({ message: 'Listings S3 circuit breaker reset', state: listingsS3CircuitBreaker.getStats().state });
});

// Keep legacy health check for backward compatibility
app.get('/healthcheck', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'listings' });
});

app.use(deleteListingRouter);
app.use(createListingRouter);
app.use(getListingsRouter);
app.use(getSoldListingsRouter);
app.use(getExpiredListingsRouter);
app.use(getUserListingsRouter);
app.use(getListingRouter);

app.all('*', () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
