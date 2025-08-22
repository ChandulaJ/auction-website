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
if [ -f "infrastructure/docker-compose.infrastructure.yml" ]; then
    docker-compose -f infrastructure/docker-compose.infrastructure.yml up -d
elif [ -f "docker-compose.infrastructure.yml" ]; then
    docker-compose -f docker-compose.infrastructure.yml up -d
else
    echo -e "${RED}❌ Infrastructure docker-compose file not found${NC}"
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
echo -e "${YELLOW}⏳ Waiting for databases to fully initialize...${NC}"
sleep 10

# Create logs directory if it doesn't exist
mkdir -p logs

# Define services as parallel arrays
declare -a service_names=("api-gateway" "auth" "bid" "listings" "payments" "profile" "email" "expiration")
declare -a service_ports=("8080" "3001" "3002" "3003" "3004" "3005" "3006" "3007")

# Store PIDs
pids=()

echo -e "${BLUE}📦 Installing dependencies for all services...${NC}"

# Build common package first
if [ -d "common" ]; then
    echo -e "${YELLOW}🔨 Building common package...${NC}"
    (cd common && npm install --silent && npm run build)
    echo -e "${GREEN}✅ Common package built successfully${NC}"
fi

# Install dependencies for all services
for service in "${service_names[@]}"; do
    if [ -d "services/$service" ]; then
        echo -e "${YELLOW}📦 Installing dependencies for $service service...${NC}"
        (cd services/$service && npm install --silent)
    else
        echo -e "${YELLOW}⚠️  Service directory services/$service not found, skipping...${NC}"
    fi
done

# Install frontend dependencies separately
if [ -d "frontend" ]; then
    echo -e "${YELLOW}📦 Installing dependencies for frontend...${NC}"
    (cd frontend && npm install --silent)
elif [ -d "services/frontend" ]; then
    echo -e "${YELLOW}📦 Installing dependencies for frontend...${NC}"
    (cd services/frontend && npm install --silent)
fi

echo -e "${BLUE}🚀 Starting all services...${NC}"

# Function to start a service
start_service() {
    local service=$1
    local port=$2
    
    if [ -d "services/$service" ]; then
        echo -e "${GREEN}🚀 Starting $service service on port $port...${NC}"
        
        # Check if port is already in use
        if lsof -i :$port >/dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  Port $port is already in use. Killing existing process...${NC}"
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
        
        (
            cd services/$service
            # Source environment variables if they exist
            if [ -f "../../.env.local" ]; then
                set -a
                source ../../.env.local
                set +a
            fi
            
            # Set service-specific environment variables
            export NATS_CLIENT_ID="$service-$(date +%s)-$$"
            export PORT="$port"
            export NODE_ENV=development
            
            # Start the service
            npm start
        ) > logs/$service.log 2>&1 &
        
        local pid=$!
        pids+=($pid)
        echo -e "${BLUE}🔹 Started $service (PID: $pid)${NC}"
        
        # Small delay between service starts
        sleep 3
        
        return 0
    else
        echo -e "${YELLOW}⚠️  Service directory services/$service not found${NC}"
        return 1
    fi
}

# Start API Gateway first
start_service "api-gateway" "8080"

# Start other backend services
for i in "${!service_names[@]}"; do
    service="${service_names[$i]}"
    port="${service_ports[$i]}"
    
    if [ "$service" != "api-gateway" ]; then
        start_service "$service" "$port"
    fi
done

# Start frontend service
if [ -d "frontend" ]; then
    echo -e "${GREEN}🚀 Starting frontend service on port 3000...${NC}"
    
    # Check if port 3000 is already in use
    if lsof -i :3000 >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port 3000 is already in use. Killing existing process...${NC}"
        lsof -ti :3000 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    (
        cd frontend
        export NEXT_PUBLIC_API_URL=http://localhost:8080
        export NODE_ENV=development
        export PORT=3000
        npm run dev
    ) > logs/frontend.log 2>&1 &
    
    pids+=($!)
    echo -e "${BLUE}🔹 Started frontend (PID: $!)${NC}"
    
elif [ -d "services/frontend" ]; then
    echo -e "${GREEN}🚀 Starting frontend service on port 3000...${NC}"
    
    # Check if port 3000 is already in use
    if lsof -i :3000 >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port 3000 is already in use. Killing existing process...${NC}"
        lsof -ti :3000 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    (
        cd services/frontend
        export NEXT_PUBLIC_API_URL=http://localhost:8080
        export NODE_ENV=development
        export PORT=3000
        npm run dev
    ) > logs/frontend.log 2>&1 &
    
    pids+=($!)
    echo -e "${BLUE}🔹 Started frontend (PID: $!)${NC}"
fi

echo -e "${GREEN}✅ All services started successfully!${NC}"

# Display service status
echo -e "${BLUE}📊 Service Status:${NC}"
echo -e "${GREEN}    🐳 Infrastructure (Docker):${NC}"
echo -e "      - NATS Streaming: http://localhost:8222"
echo -e "      - Redis: localhost:6379"
echo -e "      - MySQL Databases: localhost:3306-3310"
echo -e ""
echo -e "${GREEN}    🌐 API Gateway:${NC}"
echo -e "      - Gateway: http://localhost:8080"
echo -e "      - Health Check: http://localhost:8080/health"
echo -e ""
echo -e "${GREEN}    ⚙️  Backend Services:${NC}"
echo -e "      - Auth Service: http://localhost:3001"
echo -e "      - Bid Service: http://localhost:3002"
echo -e "      - Listings Service: http://localhost:3003"
echo -e "      - Payments Service: http://localhost:3004"
echo -e "      - Profile Service: http://localhost:3005"
echo -e "      - Email Service: http://localhost:3006"
echo -e "      - Expiration Service: http://localhost:3007"
echo -e ""
echo -e "${GREEN}    🖥️  Frontend:${NC}"
echo -e "      - Application: http://localhost:3000"
echo -e ""
echo -e "${YELLOW}📝 Logs are available in the logs/ directory${NC}"
echo -e "${YELLOW}🛑 To stop all services, run: ./stop-services.sh${NC}"
echo -e ""
echo -e "${GREEN}🎉 Auction Website is ready! Visit http://localhost:3000${NC}"

# Wait for services to start up
echo -e "${YELLOW}⏳ Waiting for services to initialize...${NC}"
sleep 20

# Check if services are responding
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Check API Gateway
echo -e "${YELLOW}🔍 Checking API Gateway...${NC}"
if nc -z localhost 8080 2>/dev/null; then
    echo -e "${GREEN}✅ API Gateway is responding${NC}"
else
    echo -e "${YELLOW}⚠️  API Gateway is still starting...${NC}"
    echo -e "${BLUE}📝 Check logs: tail -f logs/api-gateway.log${NC}"
fi

# Check backend services
echo -e "${YELLOW}🔍 Checking backend services...${NC}"
for i in "${!service_names[@]}"; do
    service="${service_names[$i]}"
    port="${service_ports[$i]}"
    
    if [ "$service" != "api-gateway" ]; then
        if nc -z localhost $port 2>/dev/null; then
            echo -e "${GREEN}✅ $service service (port $port) is responding${NC}"
        else
            echo -e "${YELLOW}⚠️  $service service (port $port) is still starting...${NC}"
            echo -e "${BLUE}📝 Check logs: tail -f logs/$service.log${NC}"
        fi
    fi
done

# Check frontend
echo -e "${YELLOW}🔍 Checking frontend...${NC}"
if nc -z localhost 3000 2>/dev/null; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is still starting...${NC}"
    echo -e "${BLUE}📝 Check logs: tail -f logs/frontend.log${NC}"
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping services...${NC}"
    ./stop-services.sh
    exit 0
}

# Keep script running and handle Ctrl+C
trap cleanup INT

echo -e "${BLUE}🔄 Services are running. Press Ctrl+C to stop all services.${NC}"
echo -e "${BLUE}💡 To view logs in real-time: tail -f logs/SERVICE_NAME.log${NC}"

# Keep the script running
while true; do
    sleep 5
    
    # Check if any critical services died
    failed_services=()
    for i in "${!service_names[@]}"; do
        service="${service_names[$i]}"
        port="${service_ports[$i]}"
        
        if ! nc -z localhost $port 2>/dev/null; then
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        echo -e "${RED}⚠️  Some services appear to have stopped: ${failed_services[*]}${NC}"
        echo -e "${BLUE}📝 Check their logs for more information${NC}"
    fi
done
