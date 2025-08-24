import 'express-async-errors';

import { NotFoundError, currentUser, errorHandler } from '@jjmauction/common';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import express from 'express';

import { getProfileRouter } from './routes/get-profile';
import { updateProfileRouter } from './routes/update-profile';
import { profileDatabaseCircuitBreaker } from './utils/database-circuit-breaker';

const app = express();

app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({ signed: false, secure: false }));
app.use(currentUser);

// Health check endpoint with circuit breaker status
app.get('/api/profile/health', async (req, res) => {
  const dbHealth = await profileDatabaseCircuitBreaker.checkDatabaseHealth();
  const circuitBreakerStats = profileDatabaseCircuitBreaker.getStats();
  
  const health = {
    status: dbHealth && profileDatabaseCircuitBreaker.isHealthy() ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    service: 'profile',
    database: {
      healthy: dbHealth,
      circuitBreaker: circuitBreakerStats
    }
  };
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Circuit breaker management endpoints
app.post('/api/profile/circuit-breaker/trip', (req, res) => {
  profileDatabaseCircuitBreaker.trip();
  res.json({ message: 'Profile database circuit breaker tripped', state: profileDatabaseCircuitBreaker.getStats().state });
});

app.post('/api/profile/circuit-breaker/reset', (req, res) => {
  profileDatabaseCircuitBreaker.forceReset();
  res.json({ message: 'Profile database circuit breaker reset', state: profileDatabaseCircuitBreaker.getStats().state });
});

app.use(getProfileRouter);
app.use(updateProfileRouter);

app.all('*', () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
