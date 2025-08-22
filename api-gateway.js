const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Enable CORS for all origins in development
app.use(cors({
  credentials: true,
  origin: true
}));

// Parse JSON bodies
app.use(express.json());

// Route mappings
const routes = {
  '/api/auth': 'http://localhost:3001',
  '/api/bids': 'http://localhost:3002', 
  '/api/listings': 'http://localhost:3003',
  '/api/payments': 'http://localhost:3004',
  '/api/profile': 'http://localhost:3005'
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
