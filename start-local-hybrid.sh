#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Force bash mode for associative arrays
if [ -n "$ZSH_VERSION" ]; then
    emulate -L bash
fi

echo -e "${BLUE} Starting Auction Website Infrastructure and Services${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW} Waiting for $service_name to be ready on port $port...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo -e "${GREEN} $service_name is ready!${NC}"
            return 0
        fi
        echo -e "${YELLOW}   Attempt $attempt/$max_attempts - $service_name not ready yet...${NC}"
        sleep 2
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

if ! command_exists node; then
    echo -e "${RED} Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED} npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${GREEN} All required tools are available${NC}"

# Start infrastructure services with Docker
echo -e "${BLUE} Starting infrastructure services (NATS, Redis, MySQL)...${NC}"
if [ -f "infrastructure/docker-compose.infrastructure.yml" ]; then
    docker-compose -f infrastructure/docker-compose.infrastructure.yml up -d
elif [ -f "docker-compose.infrastructure.yml" ]; then
    docker-compose -f docker-compose.infrastructure.yml up -d
else
    echo -e "${RED} Infrastructure docker-compose file not found${NC}"
    exit 1
fi

# Wait for services to be ready
wait_for_service "NATS" 4222
wait_for_service "Redis" 6379
wait_for_service "Auth MySQL" 3306
wait_for_service "Bid MySQL" 3307
wait_for_service "Listings MySQL" 3308
wait_for_service "Payments MySQL" 3309
wait_for_service "Profile MySQL" 3310

# Give databases extra time to initialize
echo -e "${YELLOW} Waiting for databases to fully initialize...${NC}"
sleep 10

# Create logs directory if it doesn't exist
mkdir -p logs

# Define services with their correct paths and ports (using regular arrays for compatibility)
services_names=("api-gateway" "auth" "bid" "listings" "payments" "profile" "email" "expiration")
services_ports=("8080" "3001" "3002" "3003" "3004" "3005" "3006" "3007")

pids=()

echo -e "${BLUE} Installing dependencies for all services...${NC}"

# Install dependencies for all services
for i in "${!services_names[@]}"; do
    service="${services_names[$i]}"
    if [ -d "services/$service" ]; then
        echo -e "${YELLOW} Installing dependencies for $service service...${NC}"
        cd services/$service
        npm install
        cd ../..
    else
        echo -e "${YELLOW} Service directory services/$service not found, skipping...${NC}"
    fi
done

# Install frontend dependencies separately
if [ -d "frontend" ]; then
    echo -e "${YELLOW} Installing dependencies for frontend...${NC}"
    cd frontend
    npm install
    cd ..
elif [ -d "services/frontend" ]; then
    echo -e "${YELLOW} Installing dependencies for frontend...${NC}"
    cd services/frontend
    npm install
    cd ../..
fi

echo -e "${BLUE} Starting all services...${NC}"

# Start API Gateway first
if [ -d "services/api-gateway" ]; then
    echo -e "${GREEN} Starting API Gateway on port 8080...${NC}"
    cd services/api-gateway
    (
        if [ -f "../../.env.local" ]; then
            source ../../.env.local
            export $(cat ../../.env.local | grep -v '^#' | xargs)
        fi
        export PORT=8080
        npm start
    ) > ../../logs/api-gateway.log 2>&1 &
    pids+=($!)
    cd ../..
    
    # Wait for API Gateway to start
    sleep 3
fi

# Start backend services
for i in "${!services_names[@]}"; do
    service="${services_names[$i]}"
    port="${services_ports[$i]}"
    
    if [ "$service" != "api-gateway" ] && [ -d "services/$service" ]; then
        echo -e "${GREEN} Starting $service service on port $port...${NC}"
        cd services/$service
        
        # Source environment variables and start service in background
        (
            if [ -f "../../.env.local" ]; then
                source ../../.env.local
                export $(cat ../../.env.local | grep -v '^#' | xargs)
            fi
            export NATS_CLIENT_ID="$service-$(date +%s)-$$"
            export PORT="$port"
            npm start
        ) > ../../logs/$service.log 2>&1 &
        
        pids+=($!)
        cd ../..
        
        # Small delay between service starts
        sleep 2
    fi
done

# Start frontend service
if [ -d "frontend" ]; then
    echo -e "${GREEN} Starting frontend service on port 3000...${NC}"
    cd frontend
    (
        export NEXT_PUBLIC_API_URL=http://localhost:8080
        export NODE_ENV=development
        export PORT=3000
        npm run dev
    ) > ../logs/frontend.log 2>&1 &
    pids+=($!)
    cd ..
elif [ -d "services/frontend" ]; then
    echo -e "${GREEN} Starting frontend service on port 3000...${NC}"
    cd services/frontend
    (
        export NEXT_PUBLIC_API_URL=http://localhost:8080
        export NODE_ENV=development
        export PORT=3000
        npm run dev
    ) > ../../logs/frontend.log 2>&1 &
    pids+=($!)
    cd ../..
fi

echo -e "${GREEN} All services started successfully!${NC}"
echo -e "${BLUE} Service Status:${NC}"
echo -e "${GREEN}    Infrastructure (Docker):${NC}"
echo -e "      - NATS Streaming: http://localhost:8222"
echo -e "      - Redis: localhost:6379"
echo -e "      - MySQL Databases: localhost:3306-3310"
echo -e ""
echo -e "${GREEN}    API Gateway:${NC}"
echo -e "      - Gateway: http://localhost:8080"
echo -e "      - Health Check: http://localhost:8080/health"
echo -e ""
echo -e "${GREEN}    Backend Services:${NC}"
echo -e "      - Auth Service: http://localhost:3001"
echo -e "      - Bid Service: http://localhost:3002"
echo -e "      - Listings Service: http://localhost:3003"
echo -e "      - Payments Service: http://localhost:3004"
echo -e "      - Profile Service: http://localhost:3005"
echo -e "      - Email Service: http://localhost:3006"
echo -e "      - Expiration Service: http://localhost:3007"
echo -e ""
echo -e "${GREEN}    Frontend:${NC}"
echo -e "      - Application: http://localhost:3000"
echo -e ""
echo -e "${YELLOW} Logs are available in the logs/ directory${NC}"
echo -e "${YELLOW} To stop all services, run: ./stop-local-hybrid.sh${NC}"
echo -e ""
echo -e "${GREEN} Auction Website is ready! Visit http://localhost:3000${NC}"

# Wait for services to start up
echo -e "${YELLOW} Waiting for services to initialize...${NC}"
sleep 15

# Check if services are responding
echo -e "${BLUE} Checking service health...${NC}"

# Check API Gateway
echo -e "${YELLOW} Checking API Gateway...${NC}"
if nc -z localhost 8080 2>/dev/null; then
    echo -e "${GREEN} API Gateway is responding${NC}"
else
    echo -e "${YELLOW} API Gateway is still starting...${NC}"
fi

# Check backend services
echo -e "${YELLOW} Checking backend services...${NC}"
for i in "${!services_names[@]}"; do
    service="${services_names[$i]}"
    port="${services_ports[$i]}"
    
    if [ "$service" != "api-gateway" ]; then
        if nc -z localhost $port 2>/dev/null; then
            echo -e "${GREEN} $service service (port $port) is responding${NC}"
        else
            echo -e "${YELLOW} $service service (port $port) is still starting...${NC}"
        fi
    fi
done

# Check frontend
echo -e "${YELLOW} Checking frontend...${NC}"
if nc -z localhost 3000 2>/dev/null; then
    echo -e "${GREEN} Frontend is responding${NC}"
else
    echo -e "${YELLOW} Frontend is still starting...${NC}"
fi

# Keep script running and handle Ctrl+C
trap 'echo -e "\n${YELLOW} Stopping services...${NC}"; ./stop-local-hybrid.sh; exit 0' INT
echo -e "${BLUE} Services are running. Press Ctrl+C to stop all services.${NC}"

# Keep the script running
while true; do
    sleep 1
done