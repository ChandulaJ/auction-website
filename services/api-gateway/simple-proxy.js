const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Manual proxy for auth service
app.all('/api/auth/*', async (req, res) => {
  try {
    console.log(`📡 [MANUAL] ${req.method} ${req.originalUrl}`);
    console.log(`📡 [MANUAL] Body:`, req.body);
    
    const targetUrl = `http://localhost:3101${req.path}`;
    console.log(`📤 [MANUAL] Forwarding to: ${targetUrl}`);
    
    const config = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'User-Agent': req.headers['user-agent'] || 'proxy',
        'Accept': req.headers['accept'] || '*/*'
      },
      timeout: 30000
    };
    
    // Add body for non-GET requests
    if (req.method !== 'GET' && req.body) {
      config.data = req.body;
    }
    
    // Add query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      config.params = req.query;
    }
    
    console.log(`📤 [MANUAL] Config:`, JSON.stringify(config, null, 2));
    
    const response = await axios(config);
    
    console.log(`📥 [MANUAL] Response status: ${response.status}`);
    console.log(`📥 [MANUAL] Response data:`, response.data);
    
    // Forward response headers
    Object.keys(response.headers).forEach(header => {
      if (!['connection', 'content-length', 'transfer-encoding'].includes(header.toLowerCase())) {
        res.set(header, response.headers[header]);
      }
    });
    
    res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error(`❌ [MANUAL] Proxy error:`, error.message);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      console.log(`❌ [MANUAL] Error status: ${error.response.status}`);
      console.log(`❌ [MANUAL] Error data:`, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.log(`❌ [MANUAL] No response received`);
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Auth service is not responding'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log(`❌ [MANUAL] Request setup error:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to proxy request'
      });
    }
  }
});

// Catch all
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

const port = 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 [MANUAL] Simple Manual Proxy running on port ${port}`);
  console.log(`📍 [MANUAL] Health check: http://localhost:${port}/health`);
  console.log(`🔗 [MANUAL] Auth proxy: http://localhost:${port}/api/auth/*`);
});
