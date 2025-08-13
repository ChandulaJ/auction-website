# Running Auction Website Locally with API Gateway

This guide shows how to run the auction website using Docker only for infrastructure services (NATS, Redis, MySQL) while running the application services natively with a proper API Gateway architecture.

## Prerequisites

- Node.js (v14 or higher)
- npm
- Docker and Docker Compose

## Architecture Overview

The application now uses a proper microservices architecture with an API Gateway that routes requests to the appropriate backend services.

```
┌─────────────────┐      ┌─────────────────┐
│   Frontend      │ ──── │   API Gateway   │
│   (Next.js)     │      │   Port 3001     │
│   Port 3000     │      └─────────────────┘
└─────────────────┘               │
                                  │ Routes to:
                 ┌────────────────┼────────────────┐
                 │                │                │
        ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
        │   Auth Service  │ │   Bid Service   │ │ Listings Service│
        │   Port 3101     │ │   Port 3102     │ │   Port 3103     │
        └─────────────────┘ └─────────────────┘ └─────────────────┘
                 │                │                │
        ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
        │Payments Service │ │Profile Service  │ │  Email Service  │
        │   Port 3104     │ │   Port 3105     │ │   Port 3106     │
        └─────────────────┘ └─────────────────┘ └─────────────────┘
                 │                │                │
        ┌─────────────────┐      │                │
        │Expiration Service│      │                │
        │   Port 3107     │      │                │
        └─────────────────┘      │                │
                 │                │                │
                 └────────────────┼────────────────┘
                                  │
    ┌──────────────────────────────────────────────────────────┐
    │                Infrastructure (Docker)                   │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
    │  │    NATS     │  │    Redis    │  │  MySQL DBs      │  │
    │  │  Port 4222  │  │  Port 6379  │  │ Ports 3306-3310 │  │
    │  └─────────────┘  └─────────────┘  └─────────────────┘  │
    └──────────────────────────────────────────────────────────┘
```

## Quick Start

1. **Configure environment variables**:
   - The `.env.local` file is already configured for this setup
   - Update AWS S3, Stripe, and email credentials as needed

2. **Start all services**:
   ```bash
   ./start-local-hybrid.sh
   ```

3. **Stop all services**:
   ```bash
   ./stop-local-hybrid.sh
   ```

## Service Architecture

### Infrastructure (Docker)
- **NATS Streaming Server** - Port 4222 (monitoring on 8222)
- **Redis** - Port 6379
- **MySQL Databases**:
  - Auth DB - Port 3306
  - Bid DB - Port 3307
  - Listings DB - Port 3308
  - Payments DB - Port 3309
  - Profile DB - Port 3310

### API Gateway (Native)
- **API Gateway** - Port 3001
  - Routes `/api/auth/*` → Auth Service (3101)
  - Routes `/api/bids/*` → Bid Service (3102)
  - Routes `/api/listings/*` → Listings Service (3103)
  - Routes `/api/payments/*` → Payments Service (3104)
  - Routes `/api/profile/*` → Profile Service (3105)
  - Health Check: `GET /health`
  - API Docs: `GET /api`

### Backend Services (Native)
- **Auth Service** - Port 3101 (Authentication & User Management)
- **Bid Service** - Port 3102 (Bidding Logic)
- **Listings Service** - Port 3103 (Auction Listings)
- **Payments Service** - Port 3104 (Payment Processing)
- **Profile Service** - Port 3105 (User Profiles)
- **Email Service** - Port 3106 (Email Notifications)
- **Expiration Service** - Port 3107 (Bid Expiration Handling)

### Frontend (Native)
- **Frontend** (Next.js) - Port 3000

## API Gateway Benefits

1. **Single Entry Point**: All API requests go through one gateway
2. **Service Discovery**: Frontend doesn't need to know individual service ports
3. **Request Routing**: Automatically routes requests to correct microservices
4. **Error Handling**: Centralized error handling for service unavailability
5. **CORS Management**: Handles CORS for all services
6. **Monitoring**: Centralized logging and health checks
7. **Future Extensibility**: Easy to add authentication, rate limiting, etc.

## Configuration

### Required Environment Variables

Update the following in `.env.local`:

```bash
# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
CLOUDINARY_API_KEY=your_actual_api_key
CLOUDINARY_API_SECRET=your_actual_api_secret

# Stripe (for payments)
STRIPE_KEY=sk_test_your_actual_stripe_key

# Email (for notifications)
EMAIL=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password
```

## API Endpoints

All API requests should be made to `http://localhost:3001` (API Gateway), which will route them appropriately:

- `POST /api/auth/signup` → Auth Service
- `POST /api/auth/signin` → Auth Service
- `GET /api/listings` → Listings Service
- `POST /api/bids` → Bid Service
- `POST /api/payments` → Payments Service
- `GET /api/profile` → Profile Service

## Logs

Service logs are stored in the `logs/` directory:
- `api-gateway.log` - API Gateway routing and errors
- `frontend.log` - Next.js frontend
- `auth.log` - Authentication service
- `bid.log` - Bidding service
- `listings.log` - Listings management
- `payments.log` - Payment processing
- `profile.log` - User profiles
- `email.log` - Email notifications
- `expiration.log` - Bid expiration handling

## Troubleshooting

### API Gateway Issues
1. Check gateway logs:
   ```bash
   tail -f logs/api-gateway.log
   ```

2. Test gateway health:
   ```bash
   curl http://localhost:3001/health
   ```

### Service Won't Start
1. Check if the port is already in use:
   ```bash
   lsof -i :PORT_NUMBER
   ```

2. Check service logs:
   ```bash
   tail -f logs/SERVICE_NAME.log
   ```

### Database Connection Issues
1. Ensure Docker containers are running:
   ```bash
   docker ps
   ```

2. Check database connectivity:
   ```bash
   docker exec -it auction-auth-mysql mysql -u root -p
   ```

### NATS Connection Issues
1. Check NATS status:
   ```bash
   curl http://localhost:8222/streaming
   ```

## Manual Service Management

If you need to start services individually:

1. **Start infrastructure**:
   ```bash
   docker-compose -f docker-compose.infrastructure.yml up -d
   ```

2. **Start API Gateway**:
   ```bash
   cd services/api-gateway
   PORT=3001 npm start
   ```

3. **Start a backend service**:
   ```bash
   cd services/SERVICE_NAME
   source ../../.env.local
   PORT=SERVICE_PORT npm start
   ```

## Features

- **API Gateway Pattern**: Single entry point for all API requests
- **Event-driven architecture** using NATS Streaming
- **Microservices** with independent databases
- **Real-time bidding** with WebSocket support
- **User authentication** with JWT
- **Payment processing** with Stripe
- **Image uploads** with Cloudinary
- **Email notifications**
- **Bid expiration** handling
- **Centralized request routing and error handling**

## Access URLs

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:3001
- **API Health Check**: http://localhost:3001/health
- **API Documentation**: http://localhost:3001/api
- **NATS Monitoring**: http://localhost:8222

Visit http://localhost:3000 to access the application!
