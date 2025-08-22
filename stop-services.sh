#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Auction Website Services${NC}"

# Kill specific services by port
echo -e "${YELLOW}🔪 Stopping services by port...${NC}"

ports=(8080 3001 3002 3003 3004 3005 3006 3007 3000)
service_names=("API Gateway" "Auth" "Bid" "Listings" "Payments" "Profile" "Email" "Expiration" "Frontend")

for i in "${!ports[@]}"; do
    port=${ports[$i]}
    service=${service_names[$i]}
    
    if lsof -i :$port >/dev/null 2>&1; then
        echo -e "${YELLOW}🔪 Stopping $service on port $port...${NC}"
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 1
        
        if ! lsof -i :$port >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service stopped${NC}"
        else
            echo -e "${RED}❌ Failed to stop $service${NC}"
        fi
    else
        echo -e "${BLUE}ℹ️  $service was not running on port $port${NC}"
    fi
done

# Kill all Node.js processes that might be our services (fallback)
echo -e "${YELLOW}🔪 Stopping any remaining Node.js services...${NC}"
pkill -f "node.*services" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true  
pkill -f "npm.*dev" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
pkill -f "ts-node" 2>/dev/null || true

# Stop Docker infrastructure
echo -e "${YELLOW}🐳 Stopping Docker infrastructure...${NC}"
if [ -f "infrastructure/docker-compose.infrastructure.yml" ]; then
    docker-compose -f infrastructure/docker-compose.infrastructure.yml down
elif [ -f "docker-compose.infrastructure.yml" ]; then
    docker-compose -f docker-compose.infrastructure.yml down
else
    echo -e "${YELLOW}⚠️  No infrastructure docker-compose file found${NC}"
fi

echo -e "${GREEN}✅ All services stopped successfully!${NC}"

# Clean up logs if they exist
if [ -d "logs" ]; then
    echo -e "${YELLOW}🧹 Cleaning up log files...${NC}"
    rm -rf logs/*.log 2>/dev/null || true
    echo -e "${GREEN}✅ Log files cleaned up${NC}"
fi

# Show final status
echo -e "${BLUE}📊 Final Status Check:${NC}"
running_processes=$(ps aux | grep -E "(node|npm|next)" | grep -v grep | wc -l)
if [ $running_processes -eq 0 ]; then
    echo -e "${GREEN}✅ No Node.js processes running${NC}"
else
    echo -e "${YELLOW}⚠️  $running_processes Node.js processes still running${NC}"
fi

docker_containers=$(docker ps --filter "name=auction" --format "table {{.Names}}" | grep -v NAMES | wc -l)
if [ $docker_containers -eq 0 ]; then
    echo -e "${GREEN}✅ No auction-related Docker containers running${NC}"
else
    echo -e "${YELLOW}⚠️  $docker_containers auction-related containers still running${NC}"
fi

echo -e "${GREEN}🎉 Cleanup complete!${NC}"
