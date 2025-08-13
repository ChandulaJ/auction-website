# Running Auction Website Locally (Hybrid Mode)

This guide shows how to run the auction website using Docker only for infrastructure services (NATS, Redis, MySQL) while running the application services natively.

## Prerequisites

- Node.js (v14 or higher)
- npm
- Docker and Docker Compose

## Quick Start

1. **Configure environment variables**:

   - The `.env.local` file is already configured for this setup
   - Update Cloudinary, Stripe, and email credentials as needed
2. **Start all services**:

   ```bash
   ./start-local-hybrid.sh
   ```
3. **Stop all services**:

   ```bash
   ./stop-local-hybrid.sh
   ```

## What the Script Does

### Infrastructure (Docker)

- **NATS Streaming Server** - Port 4222 (monitoring on 8222)
- **Redis** - Port 6379
- **MySQL Databases**:
  - Auth DB - Port 3306
  - Bid DB - Port 3307
  - Listings DB - Port 3308
  - Payments DB - Port 3309
  - Profile DB - Port 3310

### Application Services (Native)

- **Frontend** (Next.js) - Port 3000
- **Auth Service** - Port 3001
- **Bid Service** - Port 3002
- **Listings Service** - Port 3003
- **Payments Service** - Port 3004
- **Profile Service** - Port 3005
- **Email Service** - Port 3006
- **Expiration Service** - Port 3007

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

## Logs

Service logs are stored in the `logs/` directory:

- `frontend.log` - Next.js frontend
- `auth.log` - Authentication service
- `bid.log` - Bidding service
- `listings.log` - Listings management
- `payments.log` - Payment processing
- `profile.log` - User profiles
- `email.log` - Email notifications
- `expiration.log` - Bid expiration handling

## Troubleshooting

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
2. **Start a specific service**:

   ```bash
   cd services/SERVICE_NAME
   source ../../.env.local
   npm start
   ```

## Architecture

```
 ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Auth Service  │    │   Bid Service   │
│   (Next.js)     │    │   Port 3001     │    │   Port 3002     │
│   Port 3000     │    └─────────────────┘    └─────────────────┘
└─────────────────┘              │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Listings Service│    │Payments Service │    │Profile Service  │
│   Port 3003     │    │   Port 3004     │    │   Port 3005     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐              │
│  Email Service  │    │Expiration Service│              │
│   Port 3006     │    │   Port 3007     │              │
└─────────────────┘    └─────────────────┘              │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                Infrastructure (Docker)                  │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
    │  │    NATS     │  │    Redis    │  │  MySQL DBs      │ │
    │  │  Port 4222  │  │  Port 6379  │  │ Ports 3306-3310 │ │
    │  └─────────────┘  └─────────────┘  └─────────────────┘ │
    └─────────────────────────────────────────────────────────┘
```

## Features

- **Event-driven architecture** using NATS Streaming
- **Microservices** with independent databases
- **Real-time bidding** with WebSocket support
- **User authentication** with JWT
- **Payment processing** with Stripe
- **Image uploads** with Cloudinary
- **Email notifications**
- **Bid expiration** handling

Visit http://localhost:3000 to access the application!
