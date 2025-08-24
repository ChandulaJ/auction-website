import 'express-async-errors';

import { NotFoundError, currentUser, errorHandler } from '@jjmauction/common';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import express from 'express';

import { currentUserRouter } from './routes/current-user';
import { signinRouter } from './routes/signin';
import { signoutRouter } from './routes/signout';
import { signupRouter } from './routes/signup';
import { updatePasswordRouter } from './routes/update-password';
import { authDatabaseCircuitBreaker } from './utils/database-circuit-breaker';

const app = express();

app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({ signed: false, secure: false }));
app.use(currentUser);

// Health check endpoint with circuit breaker status
app.get('/api/auth/health', async (req, res) => {
  const dbHealth = await authDatabaseCircuitBreaker.checkDatabaseHealth();
  const circuitBreakerStats = authDatabaseCircuitBreaker.getStats();
  
  const health = {
    status: dbHealth && authDatabaseCircuitBreaker.isHealthy() ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    service: 'auth',
    database: {
      healthy: dbHealth,
      circuitBreaker: circuitBreakerStats
    }
  };
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Circuit breaker management endpoints
app.post('/api/auth/circuit-breaker/trip', (req, res) => {
  authDatabaseCircuitBreaker.trip();
  res.json({ message: 'Auth database circuit breaker tripped', state: authDatabaseCircuitBreaker.getStats().state });
});

app.post('/api/auth/circuit-breaker/reset', (req, res) => {
  authDatabaseCircuitBreaker.forceReset();
  res.json({ message: 'Auth database circuit breaker reset', state: authDatabaseCircuitBreaker.getStats().state });
});

app.use(updatePasswordRouter);
app.use(currentUserRouter);
app.use(signinRouter);
app.use(signoutRouter);
app.use(signupRouter);

app.all('*', () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
