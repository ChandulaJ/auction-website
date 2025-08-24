import 'express-async-errors';

import { NotFoundError, currentUser, errorHandler } from '@jjmauction/common';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import express from 'express';

import { createPaymentRouter } from './routes/create-payment';
import { stripe } from './stripe-circuit-breaker';

const app = express();

app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({ signed: false, secure: false }));
app.use(currentUser);

// Health check endpoint with circuit breaker status
app.get('/health', (req, res) => {
  const stripeHealth = stripe.getHealthStatus();
  
  res.status(stripeHealth.isHealthy ? 200 : 503).json({
    status: stripeHealth.isHealthy ? 'healthy' : 'unhealthy',
    service: 'payments',
    timestamp: new Date().toISOString(),
    stripe: {
      isHealthy: stripeHealth.isHealthy,
      circuitBreaker: stripeHealth.stats
    }
  });
});

app.use(createPaymentRouter);

app.all('*', () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
