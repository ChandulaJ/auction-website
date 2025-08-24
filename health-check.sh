#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Health Check - Auction Website Services${NC}"

# Function to check HTTP endpoint
check_http() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name... "
    
    if command -v curl >/dev/null 2>&1; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✅ OK${NC}"
            return 0
        else
            echo -e "${RED}❌ Failed (HTTP $response)${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  curl not available${NC}"
        return 1
    fi
}

# Function to check TCP port
check_port() {
    local service_name=$1
    local host=$2
    local port=$3
    
    echo -n "Checking $service_name... "
    
    if nc -z "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ Not responding${NC}"
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local container_name=$1
    
    echo -n "Checking container $container_name... "
    
    if docker ps --format "table {{.Names}}" | grep -q "^$container_name$"; then
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null)
        if [ "$status" = "healthy" ] || [ -z "$status" ]; then
            echo -e "${GREEN}✅ Running${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Running but unhealthy${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Not running${NC}"
        return 1
    fi
}

echo -e "\n${BLUE}📦 Docker Containers${NC}"
check_container "auction-nats"
check_container "auction-redis"
check_container "auction-auth-mysql"
check_container "auction-bid-mysql"
check_container "auction-listings-mysql"
check_container "auction-payments-mysql"
check_container "auction-profile-mysql"
check_container "auction-api-gateway"
check_container "auction-auth"
check_container "auction-bid"
check_container "auction-listings"
check_container "auction-payments"
check_container "auction-profile"
check_container "auction-email"
check_container "auction-expiration"
check_container "auction-frontend"

echo -e "\n${BLUE}🏗️ Infrastructure Services${NC}"
check_port "NATS Streaming" "localhost" "4222"
check_port "NATS Monitoring" "localhost" "8222"
check_port "Redis" "localhost" "6379"
check_port "Auth MySQL" "localhost" "3306"
check_port "Bid MySQL" "localhost" "3307"
check_port "Listings MySQL" "localhost" "3308"
check_port "Payments MySQL" "localhost" "3309"
check_port "Profile MySQL" "localhost" "3310"

echo -e "\n${BLUE}🌐 HTTP Services${NC}"
check_http "API Gateway" "http://localhost:3001/health"
check_http "Auth Service" "http://localhost:3101/api/users/currentuser"
check_http "Bid Service" "http://localhost:3102"
check_http "Listings Service" "http://localhost:3103"
check_http "Payments Service" "http://localhost:3104"
check_http "Profile Service" "http://localhost:3105"
check_http "Email Service" "http://localhost:3106"
check_http "Expiration Service" "http://localhost:3107"
check_http "Frontend" "http://localhost:3000" "200"

echo -e "\n${BLUE}📊 Docker Compose Status${NC}"
if command -v docker-compose >/dev/null 2>&1; then
    docker-compose ps
else
    echo -e "${YELLOW}⚠️  docker-compose not available${NC}"
fi

echo -e "\n${BLUE}💾 Resource Usage${NC}"
if command -v docker >/dev/null 2>&1; then
    echo "Memory and CPU usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
else
    echo -e "${YELLOW}⚠️  docker not available${NC}"
fi

echo -e "\n${BLUE}🔗 Quick Links${NC}"
echo -e "Frontend:        http://localhost:3000"
echo -e "API Gateway:     http://localhost:3001"
echo -e "NATS Monitor:    http://localhost:8222"

echo -e "\n${GREEN}✅ Health check complete!${NC}"
