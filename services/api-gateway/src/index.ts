import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from '../config/default';

interface CustomError extends Error {
  status?: number;
}

class ApiGateway {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    }));

    // CORS middleware
    this.app.use(cors(config.cors));

    // Logging middleware
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: config.services
      });
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
            paths: service.paths
          };
          return acc;
        }, {} as Record<string, { url: string; paths: string[] }>)
      });
    });

    // Setup service proxies
    Object.entries(config.services).forEach(([serviceName, serviceConfig]) => {
      serviceConfig.paths.forEach(path => {
        console.log(`🔗 Proxying ${path}/* → ${serviceConfig.url}`);
        
        this.app.use(path, createProxyMiddleware({
          target: serviceConfig.url,
          changeOrigin: config.proxy.changeOrigin,
          timeout: config.proxy.timeout,
          logLevel: config.proxy.logLevel as any,
          onError: (err: Error, req: Request, res: Response) => {
            console.error(`❌ Proxy Error for ${serviceName}:`, err.message);
            res.status(503).json({
              error: 'Service Unavailable',
              message: `${serviceName} service is currently unavailable`,
              path: req.path,
              timestamp: new Date().toISOString()
            });
          },
          onProxyReq: (proxyReq, req: Request, res: Response) => {
            console.log(`📡 Proxying ${req.method} ${req.path} → ${serviceName}`);
          },
          onProxyRes: (proxyRes, req: Request, res: Response) => {
            console.log(`📨 Response from ${serviceName}: ${proxyRes.statusCode}`);
          }
        }));
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

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
      console.error('❌ Gateway Error:', err);
      
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
        console.log('🚀 API Gateway started successfully!');
        console.log(`📍 Gateway URL: http://${config.server.host}:${config.server.port}`);
        console.log('🔗 Service Routes:');
        
        Object.entries(config.services).forEach(([name, service]) => {
          service.paths.forEach(path => {
            console.log(`   ${path}/* → ${service.url}`);
          });
        });
        
        console.log('\n📋 Available Endpoints:');
        console.log(`   GET  /health - Health check`);
        console.log(`   GET  /api - API documentation`);
        console.log('');
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        console.log('📴 Received SIGTERM, shutting down gracefully...');
        server.close(() => {
          console.log('✅ API Gateway stopped');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        console.log('📴 Received SIGINT, shutting down gracefully...');
        server.close(() => {
          console.log('✅ API Gateway stopped');
          process.exit(0);
        });
      });

    } catch (error) {
      console.error('❌ Failed to start API Gateway:', error);
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
