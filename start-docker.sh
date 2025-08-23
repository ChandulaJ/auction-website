#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE} Starting Auction Website with Docker Compose${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=60
    local attempt=1

    echo -e "${YELLOW} Waiting for $service_name to be ready on port $port...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo -e "${GREEN} $service_name is ready!${NC}"
            return 0
        fi
        echo -e "${YELLOW}   Attempt $attempt/$max_attempts - $service_name not ready yet...${NC}"
        sleep 3
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED} $service_name failed to start after $max_attempts attempts${NC}"
    return 1
}

# Check required tools
echo -e "${BLUE} Checking required tools...${NC}"

if ! command_exists docker; then
    echo -e "${RED} Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED} Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN} All required tools are available${NC}"

# Clean up any existing containers
echo -e "${BLUE} Cleaning up existing containers...${NC}"
docker-compose down -v 2>/dev/null || true

# Build and start all services
echo -e "${BLUE}  Building and starting all services...${NC}"
docker-compose up -d --build

# Wait for infrastructure services to be ready
echo -e "${BLUE} Waiting for infrastructure services...${NC}"
wait_for_service "NATS" 4222
wait_for_service "Redis" 6379
wait_for_service "Auth MySQL" 3306
wait_for_service "Bid MySQL" 3307
wait_for_service "Listings MySQL" 3308
wait_for_service "Payments MySQL" 3309
wait_for_service "Profile MySQL" 3310

# Give databases extra time to initialize
echo -e "${YELLOW} Waiting for databases to fully initialize...${NC}"
sleep 20

# Wait for application services
echo -e "${BLUE} Waiting for application services...${NC}"
wait_for_service "API Gateway" 3001
wait_for_service "Auth Service" 3101
wait_for_service "Bid Service" 3102
wait_for_service "Listings Service" 3103
wait_for_service "Payments Service" 3104
wait_for_service "Profile Service" 3105
wait_for_service "Email Service" 3106
wait_for_service "Expiration Service" 3107

# Wait for frontend
echo -e "${BLUE} Waiting for frontend...${NC}"
wait_for_service "Frontend" 3000

echo -e "${GREEN} All services started successfully!${NC}"
echo -e "${BLUE} Service Status:${NC}"
echo -e "${GREEN}      Infrastructure (Docker):${NC}"
echo -e "      - NATS Streaming: http://localhost:8222"
echo -e "      - Redis: localhost:6379"
echo -e "      - Auth MySQL: localhost:3306"
echo -e "      - Bid MySQL: localhost:3307"
echo -e "      - Listings MySQL: localhost:3308"
echo -e "      - Payments MySQL: localhost:3309"
echo -e "      - Profile MySQL: localhost:3310"
echo -e ""
echo -e "${GREEN}    🚪 API Gateway:${NC}"
echo -e "      - Gateway: http://localhost:3001"
echo -e "      - Health Check: http://localhost:3001/health"
echo -e "      - API Docs: http://localhost:3001/api"
echo -e ""
echo -e "${GREEN}     Backend Services:${NC}"
echo -e "      - Auth Service: http://localhost:3101"
echo -e "      - Bid Service: http://localhost:3102"
echo -e "      - Listings Service: http://localhost:3103"
echo -e "      - Payments Service: http://localhost:3104"
echo -e "      - Profile Service: http://localhost:3105"
echo -e "      - Email Service: http://localhost:3106"
echo -e "      - Expiration Service: http://localhost:3107"
echo -e ""
echo -e "${GREEN}     Frontend:${NC}"
echo -e "      - Next.js App: http://localhost:3000"
echo -e ""
echo -e "${YELLOW} Docker Commands:${NC}"
echo -e "      - View logs: docker-compose logs -f [service-name]"
echo -e "      - Stop services: docker-compose down"
echo -e "      - Stop and remove volumes: docker-compose down -v"
echo -e "      - Restart a service: docker-compose restart [service-name]"
echo -e ""
echo -e "${GREEN} Auction Website is ready! Visit http://localhost:3000${NC}"

# Show running containers
echo -e "${BLUE} Running containers:${NC}"
docker-compose ps

# Keep script running and handle Ctrl+C
trap 'echo -e "\n${YELLOW} Stopping services...${NC}"; docker-compose down; exit 0' INT
echo -e "${BLUE} Services are running. Press Ctrl+C to stop all services.${NC}"

# Keep the script running
while true; do
    sleep 1
done
