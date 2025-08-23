# Docker Setup for Auction Website

This document explains how to run the entire Auction Website microservices architecture using Docker Compose.

## Prerequisites

- Docker (version 20.0 or later)
- Docker Compose (version 2.0 or later)
- Git (for dependencies)

## Architecture Overview

The system consists of the following services:

### Infrastructure Services
- **NATS Streaming Server** (Port 4222) - Message broker for inter-service communication
- **Redis** (Port 6379) - Cache and session storage for expiration service
- **MySQL Databases** (Ports 3306-3310) - Separate databases for each microservice

### Microservices
- **API Gateway** (Port 3001) - Single entry point for all API requests
- **Auth Service** (Port 3101) - User authentication and authorization
- **Bid Service** (Port 3102) - Bidding functionality
- **Listings Service** (Port 3103) - Auction listings management
- **Payments Service** (Port 3104) - Payment processing via Stripe
- **Profile Service** (Port 3105) - User profile management
- **Email Service** (Port 3106) - Email notifications
- **Expiration Service** (Port 3107) - Auction expiration handling

### Frontend
- **Next.js Frontend** (Port 3000) - User interface

## Quick Start

### 1. Start All Services
```bash
./start-docker.sh
```

This script will:
- Build all Docker images
- Start all services with proper dependencies
- Wait for services to be healthy
- Display service status and URLs

### 2. Access the Application
- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **API Documentation**: http://localhost:3001/api

### 3. Stop All Services
```bash
./stop-docker.sh
```

To stop and remove all data/volumes:
```bash
./stop-docker.sh --clean
```

## Manual Docker Compose Commands

### Start Services
```bash
# Start all services in background
docker-compose up -d

# Start with rebuild
docker-compose up -d --build

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f auth
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v
```

### Service Management
```bash
# Restart a specific service
docker-compose restart auth

# Scale a service (if needed)
docker-compose up -d --scale auth=2

# View running containers
docker-compose ps

# Execute command in container
docker-compose exec auth sh
```

## Environment Variables

Each service can be configured using environment variables. The Docker Compose file includes default development settings.

### Key Environment Variables:
- `NODE_ENV=development`
- `JWT_KEY=auction-jwt-secret`
- `MYSQL_ROOT_PASSWORD=password`
- Database connection strings are automatically configured for Docker network

## Database Initialization

The MySQL databases will be automatically created on first run:
- `auth` database (Port 3306)
- `bid` database (Port 3307)
- `listings` database (Port 3308)
- `payments` database (Port 3309)
- `profile` database (Port 3310)

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using the port
   lsof -i :3000
   
   # Kill the process if needed
   kill -9 <PID>
   ```

2. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose logs mysql-auth
   
   # Connect to database directly
   docker-compose exec auth-mysql mysql -u root -p
   ```

3. **Service Won't Start**
   ```bash
   # Check service logs
   docker-compose logs <service-name>
   
   # Rebuild specific service
   docker-compose build <service-name>
   ```

4. **Clean Reset**
   ```bash
   # Complete cleanup
   docker-compose down -v
   docker system prune -f
   ./start-docker.sh
   ```

### Service Health Checks

The Docker Compose includes health checks for:
- NATS Streaming (checks port 4222)
- Redis (ping command)
- MySQL databases (mysqladmin ping)

Services wait for their dependencies to be healthy before starting.

## Development Workflow

### Making Changes

1. **Code Changes**: After making code changes, rebuild the specific service:
   ```bash
   docker-compose build <service-name>
   docker-compose up -d <service-name>
   ```

2. **Database Changes**: If you need to reset databases:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

3. **View Logs**: Monitor service logs during development:
   ```bash
   docker-compose logs -f <service-name>
   ```

### Debugging

1. **Access Service Container**:
   ```bash
   docker-compose exec <service-name> sh
   ```

2. **Check Service Status**:
   ```bash
   curl http://localhost:3001/health
   ```

3. **Database Access**:
   ```bash
   # Connect to auth database
   docker-compose exec auth-mysql mysql -u root -p auth
   ```

## Differences from Hybrid Setup

The Docker setup differs from `start-local-hybrid.sh` in the following ways:

1. **Isolation**: Each service runs in its own container
2. **Networking**: Services communicate via Docker network instead of localhost
3. **Dependencies**: Automatic dependency management with health checks
4. **Scaling**: Easy to scale individual services
5. **Consistency**: Same environment across different machines

## Production Considerations

For production deployment:

1. **Environment Variables**: Use production values
2. **Secrets Management**: Use Docker secrets or external secret management
3. **Persistence**: Configure volume persistence for databases
4. **Load Balancing**: Add load balancers for high availability
5. **Monitoring**: Add monitoring and logging solutions
6. **Security**: Configure proper network security and access controls
