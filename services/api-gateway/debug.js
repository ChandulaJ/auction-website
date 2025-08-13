const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Simple auth proxy with detailed logging
app.use('/api/auth', (req, res, next) => {
  console.log(`📡 [DEBUG] Received ${req.method} ${req.originalUrl}`);
  console.log(`📡 [DEBUG] Headers:`, req.headers);
  console.log(`📡 [DEBUG] Body:`, req.body);
  next();
}, createProxyMiddleware({
  target: 'http://localhost:3101',
  changeOrigin: true,
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error(`❌ [DEBUG] Proxy Error:`, err.message);
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Auth service is currently unavailable',
        details: err.message
      });
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`📤 [DEBUG] Forwarding to: http://localhost:3101${req.path}`);
    console.log(`📤 [DEBUG] Proxy headers:`, proxyReq.getHeaders());
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`📥 [DEBUG] Response from auth service: ${proxyRes.statusCode}`);
    console.log(`📥 [DEBUG] Response headers:`, proxyRes.headers);
  }
}));

// Catch all
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

const port = 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 [DEBUG] Simple API Gateway running on port ${port}`);
  console.log(`📍 [DEBUG] Health check: http://localhost:${port}/health`);
  console.log(`🔗 [DEBUG] Auth proxy: http://localhost:${port}/api/auth/*`);
});
