#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Auction Website Infrastructure and Services${NC}"

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

    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready on port $port...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        echo -e "${YELLOW}   Attempt $attempt/$max_attempts - $service_name not ready yet...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to start after $max_attempts attempts${NC}"
    return 1
}

# Check required tools
echo -e "${BLUE}🔍 Checking required tools...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All required tools are available${NC}"

# Start infrastructure services with Docker
echo -e "${BLUE}🐳 Starting infrastructure services (NATS, Redis, MySQL)...${NC}"
docker-compose -f docker-compose.infrastructure.yml up -d

# Wait for services to be ready
wait_for_service "NATS" 4222
wait_for_service "Redis" 6379
wait_for_service "Auth MySQL" 3306
wait_for_service "Bid MySQL" 3307
wait_for_service "Listings MySQL" 3308
wait_for_service "Payments MySQL" 3309
wait_for_service "Profile MySQL" 3310

# Give databases extra time to initialize
echo -e "${YELLOW}⏳ Waiting for databases to fully initialize...${NC}"
sleep 10

# Install dependencies for common package
echo -e "${BLUE}📦 Installing common package dependencies...${NC}"
cd common && npm install && npm run build
cd ..

# Install and start services
services=("api-gateway" "auth" "bid" "listings" "payments" "profile" "email" "expiration" "frontend")
pids=()

echo -e "${BLUE}🛠️ Installing dependencies and starting services...${NC}"

# Install dependencies for all services
for service in "${services[@]}"; do
    if [ "$service" != "frontend" ]; then
        echo -e "${YELLOW}📦 Installing dependencies for $service service...${NC}"
        cd services/$service
        npm install
        cd ../..
    fi
done

# Install frontend dependencies separately
echo -e "${YELLOW}📦 Installing dependencies for frontend service...${NC}"
cd services/frontend
npm install
cd ../..

# Start API Gateway first
echo -e "${GREEN}🌐 Starting API Gateway on port 3001...${NC}"
cd services/api-gateway
(
    source ../../.env.local
    export $(cat ../../.env.local | grep -v '^#' | xargs)
    export PORT=3001
    npm start
) > ../../logs/api-gateway.log 2>&1 &
pids+=($!)
cd ../..

# Wait for API Gateway to start
sleep 3

# Start backend services
backend_services=("auth" "bid" "listings" "payments" "profile" "email" "expiration")
service_ports=("3101" "3102" "3103" "3104" "3105" "3106" "3107")

for i in "${!backend_services[@]}"; do
    service="${backend_services[$i]}"
    port="${service_ports[$i]}"
    echo -e "${GREEN}🚀 Starting $service service on port $port...${NC}"
    cd services/$service
    
    # Source environment variables and start service in background
    (
        source ../../.env.local
        export $(cat ../../.env.local | grep -v '^#' | xargs)
        export NATS_CLIENT_ID="$service-$(date +%s)-$$"
        export PORT="$port"
        npm start
    ) > ../../logs/$service.log 2>&1 &
    
    pids+=($!)
    cd ../..
    
    # Small delay between service starts
    sleep 2
done

# Start frontend service
echo -e "${GREEN}🌐 Starting frontend service on port 3000...${NC}"
cd services/frontend
(
    # Set frontend-specific environment variables
    export NEXT_PUBLIC_API_URL=http://localhost:3001
    export NODE_ENV=development
    export PORT=3000
    npm run dev
) > ../../logs/frontend.log 2>&1 &
pids+=($!)
cd ../..

# Create logs directory if it doesn't exist
mkdir -p logs

echo -e "${GREEN}✅ All services started successfully!${NC}"
echo -e "${BLUE}📋 Service Status:${NC}"
echo -e "${GREEN}   🐳 Infrastructure (Docker):${NC}"
echo -e "      - NATS Streaming: http://localhost:8222"
echo -e "      - Redis: localhost:6379"
echo -e "      - Auth MySQL: localhost:3306"
echo -e "      - Bid MySQL: localhost:3307"
echo -e "      - Listings MySQL: localhost:3308"
echo -e "      - Payments MySQL: localhost:3309"
echo -e "      - Profile MySQL: localhost:3310"
echo -e ""
echo -e "${GREEN}   🌐 API Gateway:${NC}"
echo -e "      - Gateway: http://localhost:3001"
echo -e "      - Health Check: http://localhost:3001/health"
echo -e "      - API Docs: http://localhost:3001/api"
echo -e ""
echo -e "${GREEN}   🚀 Backend Services:${NC}"
echo -e "      - Auth Service: http://localhost:3101"
echo -e "      - Bid Service: http://localhost:3102"
echo -e "      - Listings Service: http://localhost:3103"
echo -e "      - Payments Service: http://localhost:3104"
echo -e "      - Profile Service: http://localhost:3105"
echo -e "      - Email Service: http://localhost:3106"
echo -e "      - Expiration Service: http://localhost:3107"
echo -e ""
echo -e "${GREEN}   🎨 Frontend:${NC}"
echo -e "      - Next.js App: http://localhost:3000"
echo -e ""
echo -e "${YELLOW}📝 Logs are available in the logs/ directory${NC}"
echo -e "${YELLOW}🛑 To stop all services, run: ./stop-local.sh${NC}"
echo -e ""
echo -e "${GREEN}🎉 Auction Website is ready! Visit http://localhost:3000${NC}"

# Wait for services to start up
echo -e "${YELLOW}⏳ Waiting for services to initialize...${NC}"
sleep 15

# Check if services are responding
echo -e "${BLUE}🔍 Checking service health...${NC}"
echo -e "${YELLOW}⏳ Checking API Gateway...${NC}"
if nc -z localhost 3001 2>/dev/null; then
    echo -e "${GREEN}✅ API Gateway is responding${NC}"
else
    echo -e "${YELLOW}⏳ API Gateway is still starting...${NC}"
fi

echo -e "${YELLOW}⏳ Checking backend services...${NC}"
for port in 3101 3102 3103 3104 3105 3106 3107; do
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✅ Service on port $port is responding${NC}"
    else
        echo -e "${YELLOW}⏳ Service on port $port is still starting...${NC}"
    fi
done

echo -e "${YELLOW}⏳ Checking frontend...${NC}"
if nc -z localhost 3000 2>/dev/null; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⏳ Frontend is still starting...${NC}"
fi

# Keep script running and handle Ctrl+C
trap 'echo -e "\n${YELLOW}🛑 Stopping services...${NC}"; ./stop-local.sh; exit 0' INT
echo -e "${BLUE}🔄 Services are running. Press Ctrl+C to stop all services.${NC}"

# Keep the script running
while true; do
    sleep 1
done
