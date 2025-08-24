import { EmailCreatedListener, getEmailHealthStatus, testEmailConnectivity } from './events/listeners/email-created-listener-with-circuit-breaker';
import { natsWrapper } from './nats-wrapper';
import express from 'express';

(async () => {
  try {
    console.log('The profile service has started');

    if (!process.env.EMAIL) {
      throw new Error('EMAIL must be defined');
    }

    if (!process.env.EMAIL_PASSWORD) {
      throw new Error('EMAIL_PASSWORD must be defined');
    }

    if (!process.env.NATS_CLIENT_ID) {
      throw new Error('NATS_CLIENT_ID must be defined');
    }

    if (!process.env.NATS_URL) {
      throw new Error('NATS_URL must be defined');
    }

    if (!process.env.NATS_CLUSTER_ID) {
      throw new Error('NATS_CLUSTER_ID must be defined');
    }

    await natsWrapper.connect(
      process.env.NATS_CLUSTER_ID,
      process.env.NATS_CLIENT_ID,
      process.env.NATS_URL
    );

    natsWrapper.client.on('close', () => {
      console.log('NATS connection closed!');
      process.exit();
    });

    process.on('SIGINT', () => natsWrapper.client.close());
    process.on('SIGTERM', () => natsWrapper.client.close());

    // Create express app for health endpoints
    const app = express();
    
    // Health check endpoint with circuit breaker status
    app.get('/health', async (req, res) => {
      const emailHealth = getEmailHealthStatus();
      const connectivityTest = await testEmailConnectivity();
      
      res.status(emailHealth.isHealthy ? 200 : 503).json({
        status: emailHealth.isHealthy ? 'healthy' : 'unhealthy',
        service: 'email',
        timestamp: new Date().toISOString(),
        smtp: {
          isHealthy: emailHealth.isHealthy,
          connectivityTest,
          circuitBreaker: emailHealth.stats
        }
      });
    });

    // Start HTTP server for health checks
    const port = process.env.PORT || 3106;
    app.listen(port, () => {
      console.log(`[Email Service] Health endpoint listening on port ${port}`);
    });

    await new EmailCreatedListener(natsWrapper.client).listen();

    console.log('The email service has started up successfully');
  } catch (err) {
    console.error(err);
    process.exit(0);
  }
})();
