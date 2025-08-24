import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import FormData from 'form-data';
import config from '../config/default';

// Circuit Breaker imports
interface CircuitBreaker {
  execute: <T>(operation: () => Promise<T>) => Promise<T>;
  isHealthy: () => boolean;
  getStats: () => any;
  trip: () => void;
  forceReset: () => void;
}

interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
  onStateChange?: (state: string, name: string) => void;
  onFallback?: (error: Error, name: string) => any;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class SimpleCircuitBreaker implements CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const error = new Error(`Circuit breaker is OPEN for ${this.options.name}`);
      if (this.options.onFallback) {
        return this.options.onFallback(error, this.options.name);
      }
      throw error;
    }

    this.totalRequests++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private canExecute(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
      case CircuitState.OPEN:
        if (this.shouldAttemptReset(now)) {
          this.setState(CircuitState.HALF_OPEN);
          return true;
        }
        return false;
      case CircuitState.HALF_OPEN:
        return true;
      default:
        return false;
    }
  }

  private onSuccess(): void {
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.options.successThreshold) {
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failureCount >= this.options.failureThreshold) {
        this.setState(CircuitState.OPEN);
      }
    }
  }

  private shouldAttemptReset(now: number): boolean {
    return this.lastFailureTime !== null && 
           (now - this.lastFailureTime) >= this.options.timeout;
  }

  private reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.setState(CircuitState.CLOSED);
  }

  private setState(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;
    
    if (newState !== previousState) {
      console.log(`[Circuit Breaker] '${this.options.name}' changed from ${previousState} to ${newState}`);
      
      if (this.options.onStateChange) {
        this.options.onStateChange(newState, this.options.name);
      }
    }

    if (newState === CircuitState.HALF_OPEN || newState === CircuitState.OPEN) {
      this.successCount = 0;
    }
  }

  isHealthy(): boolean {
    return this.state !== CircuitState.OPEN;
  }

  getStats() {
    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      errorRate: this.totalRequests > 0 ? (this.totalFailures / this.totalRequests) * 100 : 0
    };
  }

  trip(): void {
    this.setState(CircuitState.OPEN);
    this.lastFailureTime = Date.now();
  }

  forceReset(): void {
    this.reset();
  }
}

interface CustomError extends Error {
  status?: number;
}

class ApiGateway {
  private app: express.Application;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.app = express();
    this.initializeCircuitBreakers();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private initializeCircuitBreakers(): void {
    // Create circuit breakers for each service
    Object.keys(config.services).forEach(serviceName => {
      const circuitBreaker = new SimpleCircuitBreaker({
        name: serviceName,
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        onStateChange: (state: string, name: string) => {
          console.log(`[API Gateway] Circuit breaker for ${name} changed to ${state}`);
          
          if (state === 'OPEN') {
            console.error(`⚠️  Service ${name} circuit breaker OPEN - requests will be blocked`);
          } else if (state === 'CLOSED') {
            console.info(`✅ Service ${name} circuit breaker CLOSED - normal operation restored`);
          }
        },
        onFallback: (error: Error, name: string) => {
          console.warn(`[API Gateway] Using fallback for ${name}: ${error.message}`);
          // Return a standardized service unavailable response
          return {
            status: 503,
            data: {
              error: 'Service Temporarily Unavailable',
              message: `The ${name} service is currently experiencing issues. Please try again later.`,
              serviceName: name,
              timestamp: new Date().toISOString(),
              retryAfter: '60 seconds'
            }
          };
        }
      });

      this.circuitBreakers.set(serviceName, circuitBreaker);
      console.log(`[API Gateway] Circuit breaker initialized for ${serviceName} service`);
    });
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: false,
      })
    );

    // CORS middleware
    this.app.use(cors(config.cors));

    // Logging middleware
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Custom middleware to handle different content types
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const contentType = req.headers['content-type'];

      if (contentType && contentType.includes('multipart/form-data')) {
        // For multipart form data, collect raw body
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        req.on('end', () => {
          (req as any).rawBody = Buffer.concat(chunks);
          next();
        });
      } else {
        // For other content types, use default parsing
        express.json({ limit: '10mb' })(req, res, () => {
          express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
        });
      }
    });
  }

  private setupRoutes(): void {
    // Health check endpoint with circuit breaker status
    this.app.get('/health', (req: Request, res: Response) => {
      const circuitBreakerStats = Array.from(this.circuitBreakers.entries()).map(([name, breaker]) => ({
        service: name,
        ...breaker.getStats()
      }));

      const healthyServices = circuitBreakerStats.filter(stat => stat.state !== 'OPEN');
      const unhealthyServices = circuitBreakerStats.filter(stat => stat.state === 'OPEN');

      const overallHealth = unhealthyServices.length === 0 ? 'healthy' : 'degraded';

      res.status(overallHealth === 'healthy' ? 200 : 503).json({
        status: overallHealth,
        timestamp: new Date().toISOString(),
        services: Object.keys(config.services),
        circuitBreakers: circuitBreakerStats,
        summary: {
          totalServices: circuitBreakerStats.length,
          healthyServices: healthyServices.length,
          unhealthyServices: unhealthyServices.length,
          degradedServices: unhealthyServices.map(s => s.service)
        }
      });
    });

    // Circuit breaker management endpoints
    this.app.get('/circuit-breakers', (req: Request, res: Response) => {
      const stats = Array.from(this.circuitBreakers.entries()).map(([name, breaker]) => ({
        service: name,
        ...breaker.getStats()
      }));
      res.json(stats);
    });

    this.app.post('/circuit-breakers/:serviceName/trip', (req: Request, res: Response) => {
      const { serviceName } = req.params;
      const circuitBreaker = this.circuitBreakers.get(serviceName);
      
      if (!circuitBreaker) {
        return res.status(404).json({ error: `Circuit breaker for ${serviceName} not found` });
      }
      
      circuitBreaker.trip();
      res.json({ message: `Circuit breaker for ${serviceName} has been tripped` });
    });

    this.app.post('/circuit-breakers/:serviceName/reset', (req: Request, res: Response) => {
      const { serviceName } = req.params;
      const circuitBreaker = this.circuitBreakers.get(serviceName);
      
      if (!circuitBreaker) {
        return res.status(404).json({ error: `Circuit breaker for ${serviceName} not found` });
      }
      
      circuitBreaker.forceReset();
      res.json({ message: `Circuit breaker for ${serviceName} has been reset` });
    });

    // API documentation endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.status(200).json({
        message: 'Auction Website API Gateway',
        version: '1.0.0',
        services: Object.keys(config.services),
        endpoints: Object.entries(config.services).reduce((acc, [name, service]) => {
            acc[name] = {
              url: service.url,
              paths: service.paths,
            };
            return acc;
        }, {} as Record<string, { url: string; paths: string[] }>),
        circuitBreakers: {
          enabled: true,
          endpoints: [
            'GET /circuit-breakers - View all circuit breaker stats',
            'POST /circuit-breakers/:serviceName/trip - Manually trip a circuit breaker',
            'POST /circuit-breakers/:serviceName/reset - Reset a circuit breaker'
          ]
        }
      });
    });

    // Setup service proxies using axios
    Object.entries(config.services).forEach(([serviceName, serviceConfig]) => {
      serviceConfig.paths.forEach((path) => {
        console.log(` Proxying ${path}/* → ${serviceConfig.url}`);

        // Handle exact path match (e.g., /api/listings)
        this.app.all(path, async (req: Request, res: Response) => {
          await this.proxyRequest(req, res, serviceConfig.url, serviceName);
        });

        // Handle wildcard path match (e.g., /api/listings/*)
        this.app.all(`${path}/*`, async (req: Request, res: Response) => {
          await this.proxyRequest(req, res, serviceConfig.url, serviceName);
        });
      });
    });

    // Catch-all route for unmatched paths
    this.app.all('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        availableServices: Object.keys(config.services),
        timestamp: new Date().toISOString()
      });
    });
  }

  private async proxyRequest(
    req: Request,
    res: Response,
    targetUrl: string,
    serviceName: string
  ): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!circuitBreaker) {
      console.error(`[API Gateway] No circuit breaker found for service: ${serviceName}`);
      return this.handleServiceError(res, serviceName, new Error('Service configuration error'));
    }

    try {
      console.log(`[API Gateway] Proxying ${req.method} ${req.originalUrl} → ${serviceName}`);
      
      const result = await circuitBreaker.execute(async () => {
        return this.makeServiceRequest(req, targetUrl, serviceName);
      });

      // Handle circuit breaker fallback response
      if (result && typeof result === 'object' && 'status' in result && 'data' in result) {
        res.status(result.status).json(result.data);
        return;
      }

      // Handle normal axios response
      if (result && result.status && result.data !== undefined) {
        // Forward response headers
        if (result.headers) {
          Object.keys(result.headers).forEach(header => {
            if (header.toLowerCase() !== 'content-encoding') {
              res.set(header, result.headers[header]);
            }
          });
        }
        
        res.status(result.status).json(result.data);
        return;
      }

      // Fallback for unexpected response format
      res.status(200).json(result);
      
    } catch (error: any) {
      console.error(`[API Gateway] Proxy Error for ${serviceName}:`, error.message);
      this.handleServiceError(res, serviceName, error);
    }
  }

  private async makeServiceRequest(req: Request, targetUrl: string, serviceName: string): Promise<any> {
    const fullTargetUrl = `${targetUrl}${req.originalUrl}`;
    console.log(`[API Gateway] Forwarding to: ${fullTargetUrl}`);
    
    const axiosConfig: any = {
      method: req.method.toLowerCase(),
      url: fullTargetUrl,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'User-Agent': req.headers['user-agent'] || 'api-gateway',
        Accept: req.headers['accept'] || '*/*',
        Cookie: req.headers['cookie'] || '',
      },
      timeout: config.proxy.timeout,
      validateStatus: () => true, // Don't throw errors for HTTP error status codes
    };

    // Handle different content types appropriately
    if (req.method !== 'GET') {
      const contentType = req.headers['content-type'];
      if (contentType && contentType.includes('multipart/form-data')) {
        // For multipart form data, use the raw body
        axiosConfig.data = (req as any).rawBody;
        axiosConfig.maxContentLength = Infinity;
        axiosConfig.maxBodyLength = Infinity;
      } else if (req.body) {
        // For JSON and URL-encoded data, use the parsed body
        axiosConfig.data = req.body;
      }
    }

    // Add query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      axiosConfig.params = req.query;
    }

    const response = await axios(axiosConfig);
    
    console.log(`[API Gateway] Response from ${serviceName}: ${response.status}`);
    
    // Check for service errors that should trigger circuit breaker
    if (response.status >= 500) {
      throw new Error(`Service error: ${response.status} ${response.statusText}`);
    }
    
    return response;
  }

  private handleServiceError(res: Response, serviceName: string, error: any): void {
    if (error.response) {
      // The request was made and the server responded with a status code
      console.log(`[API Gateway] Error status from ${serviceName}: ${error.response.status}`);
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.log(`[API Gateway] No response from ${serviceName}`);
      res.status(503).json({
        error: 'Service Unavailable',
        message: `${serviceName} service is currently unavailable`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Something happened in setting up the request
      console.log(`[API Gateway] Request setup error: ${error.message}`);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to proxy request',
        timestamp: new Date().toISOString()
      });
    }
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
      console.error(' Gateway Error:', err);
      
      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    });
  }

  public async start(): Promise<void> {
    try {
      const server = this.app.listen(config.server.port, config.server.host, () => {
        console.log(' API Gateway started successfully!');
        console.log(` Gateway URL: http://${config.server.host}:${config.server.port}`);
        console.log(' Service Routes:');
        
        Object.entries(config.services).forEach(([name, service]) => {
          service.paths.forEach(path => {
            console.log(`   ${path}/* → ${service.url}`);
          });
        });
        
        console.log('\n Available Endpoints:');
        console.log(`   GET  /health - Health check`);
        console.log(`   GET  /api - API documentation`);
        console.log('');
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        console.log('📴 Received SIGTERM, shutting down gracefully...');
        server.close(() => {
          console.log(' API Gateway stopped');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        console.log('📴 Received SIGINT, shutting down gracefully...');
        server.close(() => {
          console.log(' API Gateway stopped');
          process.exit(0);
        });
      });

    } catch (error) {
      console.error(' Failed to start API Gateway:', error);
      process.exit(1);
    }
  }
}

// Start the gateway if this file is run directly
if (require.main === module) {
  const gateway = new ApiGateway();
  gateway.start();
}

export default ApiGateway;
