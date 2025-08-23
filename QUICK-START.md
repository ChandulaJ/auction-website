# Quick Start Guide - Docker Setup

##  Start the Auction Website

```bash
# 1. Navigate to the project directory
cd /Users/pramithajayasooriya/Desktop/auction-website/auction-website

# 2. Start all services with Docker
./start-docker.sh

# 3. Wait for services to be ready (script will show progress)
# This may take 2-3 minutes on first run due to image building

# 4. Access the application
open http://localhost:3000
```

##  Check System Health

```bash
# Run health check
./health-check.sh

# Or check API Gateway health endpoint
curl http://localhost:3001/health
```

##  Stop the System

```bash
# Stop all services (keeps data)
./stop-docker.sh

# Stop and clean all data
./stop-docker.sh --clean
```

##  Development Commands

```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f auth

# Restart a service after code changes
docker-compose build auth
docker-compose up -d auth

# Access a service container
docker-compose exec auth sh
```

##  Service URLs

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:3001
- **API Docs**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health
- **NATS Monitor**: http://localhost:8222

##  Database Connections

All MySQL databases are accessible:
- Auth DB: `mysql -h localhost -P 3306 -u root -p` (password: `password`)
- Bid DB: `mysql -h localhost -P 3307 -u root -p` (password: `password`)
- Listings DB: `mysql -h localhost -P 3308 -u root -p` (password: `password`)
- Payments DB: `mysql -h localhost -P 3309 -u root -p` (password: `password`)
- Profile DB: `mysql -h localhost -P 3310 -u root -p` (password: `password`)

##  Comparison with Hybrid Setup

| Feature | Hybrid (`start-local-hybrid.sh`) | Docker (`start-docker.sh`) |
|---------|----------------------------------|----------------------------|
| **Setup** | Requires Node.js locally | Only requires Docker |
| **Isolation** | Services share host | Each service in container |
| **Dependencies** | Manual dependency management | Automatic with health checks |
| **Scaling** | Manual process management | Easy with Docker Compose |
| **Consistency** | Environment dependent | Same environment everywhere |
| **Development** | Hot reloading with nodemon | Rebuild container for changes |

##  What's Included

 All microservices with Dockerfiles
 Complete Docker Compose setup
 Health checks for all services
 Automatic dependency management
 Database initialization
 Network isolation
 Volume persistence
 Easy start/stop scripts
 Health monitoring
 Comprehensive documentation
