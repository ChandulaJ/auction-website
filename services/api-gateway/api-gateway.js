require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Configuration
const config = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    bids: process.env.BIDS_SERVICE_URL || 'http://localhost:3002',
    listings: process.env.LISTINGS_SERVICE_URL || 'http://localhost:3003',
    payments: process.env.PAYMENTS_SERVICE_URL || 'http://localhost:3004',
    profile: process.env.PROFILE_SERVICE_URL || 'http://localhost:3005'
  }
};

// CORS configuration
app.use(cors({
  credentials: true,
  origin: config.nodeEnv === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
    : true
}));

// Parse JSON bodies with size limit
app.use(express.json({ limit: '10mb' }));

// Route mappings using environment variables
const routes = {
  '/api/auth': config.services.auth,
  '/api/bids': config.services.bids,
  '/api/listings': config.services.listings,
  '/api/payments': config.services.payments,
  '/api/profile': config.services.profile
};

// Helper function to get target service
const getTargetService = (path) => {
  for (const [route, target] of Object.entries(routes)) {
    if (path.startsWith(route)) {
      return target;
    }
  }
  return null;
};

// Generic proxy handler
const proxyRequest = async (req, res) => {
  const target = getTargetService(req.path);
  
  if (!target) {
    console.log(`[${new Date().toISOString()}] No route found for: ${req.method} ${req.path}`);
    return res.status(404).json({
      errors: [{ message: 'Route not found' }]
    });
  }

  const targetUrl = `${target}${req.path}`;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${targetUrl}`);

  try {
    const config = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      headers: { ...req.headers },
      params: req.query
    };

    // Add body for POST, PUT, PATCH requests
    if (['post', 'put', 'patch'].includes(config.method)) {
      config.data = req.body;
    }

    // Remove host header to avoid conflicts
    delete config.headers.host;

    const response = await axios(config);
    
    // Forward response headers
    Object.keys(response.headers).forEach(header => {
      if (!['connection', 'content-length', 'transfer-encoding'].includes(header.toLowerCase())) {
        res.set(header, response.headers[header]);
      }
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Proxy error for ${req.path}:`, error.message);
    
    if (error.response) {
      // Forward error response from target service
      res.status(error.response.status).json(error.response.data);
    } else {
      // Network or other error
      res.status(503).json({
        errors: [{ message: 'Service temporarily unavailable' }]
      });
    }
  }
};

// Route all API requests through the proxy
app.all('/api/*', proxyRequest);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    routes: Object.keys(routes)
  });
});

// Catch all handler
app.use('*', (req, res) => {
  console.log(`[${new Date().toISOString()}] Unmatched route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    errors: [{ message: 'Route not found' }]
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(` API Gateway started on port ${PORT}`);
  console.log('📍 Route mappings:');
  Object.entries(routes).forEach(([route, target]) => {
    console.log(`   ${route} -> ${target}`);
  });
  console.log(` Health check available at: http://localhost:${PORT}/health`);
});

module.exports = app;
