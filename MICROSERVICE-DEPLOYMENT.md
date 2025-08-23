# Independent Microservice Deployment Guide

This guide explains how to deploy and run each microservice independently, as well as how to run the full application using the provided scripts.

## Overview

Each microservice in this auction platform can be deployed independently with its own:
- ✅ Environment variables (`.env` file)
- ✅ Dependencies (`node_modules`)
- ✅ Configuration (`.gitignore`)
- ✅ Startup script (`start-service.sh`)

## Services Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Auth Service  │
│   Port 3000     │    │   Port 3001     │    │   Port 3101     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Bid Service   │    │Listings Service │    │Payments Service │
│   Port 3102     │    │   Port 3103     │    │   Port 3104     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Profile Service │    │  Email Service  │    │Expiration Service│
│   Port 3105     │    │   Port 3106     │    │   Port 3107     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start (Full Application)

To run the complete auction platform:

```bash
# Start all services (infrastructure + microservices)
./start-local-hybrid.sh

# Stop all services
./stop-local-hybrid.sh
```

## Individual Service Deployment

### Prerequisites

- Node.js (v14 or higher)
- npm
- Docker and Docker Compose (for infrastructure services)

### Infrastructure Services

Before running any microservice, ensure infrastructure services are running:

```bash
# Start infrastructure (NATS, Redis, MySQL databases)
docker-compose -f docker-compose.infrastructure.yml up -d
```

### Service-Specific Deployment

#### 1. Frontend Service (Next.js)

```bash
cd services/frontend
./start-service.sh
```

**Environment Variables (`.env`):**
- `NEXT_PUBLIC_API_URL` - API Gateway URL
- `PORT` - Service port (default: 3000)
- `NODE_ENV` - Environment mode

**Access:** http://localhost:3000

#### 2. API Gateway

```bash
cd services/api-gateway
./start-service.sh
```

**Environment Variables (`.env`):**
- `JWT_KEY` - JWT secret key
- `AUTH_SERVICE_URL` - Auth service URL
- `BID_SERVICE_URL` - Bid service URL
- `LISTINGS_SERVICE_URL` - Listings service URL
- `PAYMENTS_SERVICE_URL` - Payments service URL
- `PROFILE_SERVICE_URL` - Profile service URL
- `PORT` - Service port (default: 3001)

**Access:** http://localhost:3001

#### 3. Auth Service

```bash
cd services/auth
./start-service.sh
```

**Environment Variables (`.env`):**
- `JWT_KEY` - JWT secret key
- `AUTH_MYSQL_URI` - MySQL database connection
- `NATS_URL` - NATS server URL
- `NATS_CLUSTER_ID` - NATS cluster identifier
- `PORT` - Service port (default: 3101)

**Database:** MySQL on port 3306

#### 4. Bid Service

```bash
cd services/bid
./start-service.sh
```

**Environment Variables (`.env`):**
- `JWT_KEY` - JWT secret key
- `BID_MYSQL_URI` - MySQL database connection
- `NATS_URL` - NATS server URL
- `PORT` - Service port (default: 3102)

**Database:** MySQL on port 3307

#### 5. Listings Service

```bash
cd services/listings
./start-service.sh
```

**Environment Variables (`.env`):**
- `JWT_KEY` - JWT secret key
- `LISTINGS_MYSQL_URI` - MySQL database connection
- `NATS_URL` - NATS server URL
- `AWS_ACCESS_KEY_ID` - AWS access key for S3
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for S3
- `AWS_REGION` - AWS region
- `AWS_S3_BUCKET_NAME` - S3 bucket for image uploads
- `PORT` - Service port (default: 3103)

**Database:** MySQL on port 3308
**External Services:** AWS S3 for image storage

#### 6. Payments Service

```bash
cd services/payments
./start-service.sh
```

**Environment Variables (`.env`):**
- `JWT_KEY` - JWT secret key
- `PAYMENTS_MYSQL_URI` - MySQL database connection
- `NATS_URL` - NATS server URL
- `STRIPE_KEY` - Stripe secret key for payments
- `PORT` - Service port (default: 3104)

**Database:** MySQL on port 3309
**External Services:** Stripe for payment processing

#### 7. Profile Service

```bash
cd services/profile
./start-service.sh
```

**Environment Variables (`.env`):**
- `JWT_KEY` - JWT secret key
- `PROFILE_MYSQL_URI` - MySQL database connection
- `NATS_URL` - NATS server URL
- `PORT` - Service port (default: 3105)

**Database:** MySQL on port 3310

#### 8. Email Service

```bash
cd services/email
./start-service.sh
```

**Environment Variables (`.env`):**
- `JWT_KEY` - JWT secret key
- `NATS_URL` - NATS server URL
- `EMAIL` - Gmail address for notifications
- `EMAIL_PASSWORD` - Gmail app-specific password
- `PORT` - Service port (default: 3106)

**External Services:** Gmail SMTP for email notifications

#### 9. Expiration Service

```bash
cd services/expiration
./start-service.sh
```

**Environment Variables (`.env`):**
- `JWT_KEY` - JWT secret key
- `NATS_URL` - NATS server URL
- `REDIS_HOST` - Redis server host
- `REDIS_PORT` - Redis server port
- `PORT` - Service port (default: 3107)

**External Services:** Redis for job scheduling

## Environment Configuration

Each service has its own `.env` file with service-specific variables. Update these files based on your deployment environment:

### Local Development
- Use provided `.env` files with localhost URLs
- Ensure all infrastructure services are running via Docker

### Production Deployment
- Update database URLs to production instances
- Configure production NATS and Redis endpoints
- Set production API keys (AWS, Stripe, etc.)
- Use production JWT secrets

## Service Dependencies

### Infrastructure Dependencies
- **NATS Streaming Server** (Port 4222) - Event messaging
- **Redis** (Port 6379) - Job queue for expiration service
- **MySQL Databases** (Ports 3306-3310) - Data persistence

### Service Dependencies
- **API Gateway** → All backend services
- **Frontend** → API Gateway
- **All Backend Services** → NATS for event communication

## Health Checks

Each service exposes health check endpoints:

```bash
# Check service health
curl http://localhost:PORT/health
```

## Logs

Service logs are available in:
- **Individual runs:** Console output
- **Full application:** `logs/` directory with service-specific log files

## Troubleshooting

### Service Won't Start
1. Check if dependencies are installed: `npm install`
2. Verify environment variables in `.env`
3. Ensure infrastructure services are running
4. Check port availability: `lsof -i :PORT`

### Database Connection Issues
1. Verify MySQL containers are running: `docker ps`
2. Check database URLs in `.env` files
3. Test connection: `docker exec -it CONTAINER_NAME mysql -u root -p`

### NATS Connection Issues
1. Verify NATS container is running
2. Check NATS monitoring: `curl http://localhost:8222/streaming`
3. Ensure unique `NATS_CLIENT_ID` for each service instance

## Production Considerations

1. **Security**: Use environment-specific secrets and keys
2. **Scaling**: Each service can be scaled independently
3. **Monitoring**: Implement service-specific health checks and metrics
4. **Load Balancing**: Place load balancers in front of service clusters
5. **Database**: Use managed database services for production
6. **Message Queue**: Use managed NATS or similar service for production

## Docker Deployment

Each service includes `Dockerfile` and `Dockerfile.dev` for containerized deployment. Use the Kubernetes configurations in the `k8s/` directory for production orchestration.
