#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE} Auction Website Health Check${NC}"

# Define services and their ports
declare -A services=(
    ["NATS Streaming"]="4222"
    ["Redis"]="6379"
    ["Auth MySQL"]="3306"
    ["Bid MySQL"]="3307"
    ["Listings MySQL"]="3308"
    ["Payments MySQL"]="3309"
    ["Profile MySQL"]="3310"
    ["API Gateway"]="3001"
    ["Auth Service"]="3101"
    ["Bid Service"]="3102"
    ["Listings Service"]="3103"
    ["Payments Service"]="3104"
    ["Profile Service"]="3105"
    ["Email Service"]="3106"
    ["Expiration Service"]="3107"
    ["Frontend"]="3000"
)

echo -e "${BLUE} Checking service health...${NC}"
echo ""

all_healthy=true

for service in "${!services[@]}"; do
    port=${services[$service]}
    
    if nc -z localhost $port 2>/dev/null; then
        echo -e " ${GREEN}$service${NC} (port $port) - ${GREEN}HEALTHY${NC}"
    else
        echo -e " ${RED}$service${NC} (port $port) - ${RED}UNHEALTHY${NC}"
        all_healthy=false
    fi
done

echo ""

if $all_healthy; then
    echo -e "${GREEN} All services are healthy!${NC}"
    echo -e "${BLUE} Access the application:${NC}"
    echo -e "   Frontend: http://localhost:3000"
    echo -e "   API Gateway: http://localhost:3001"
    echo -e "   Health Endpoint: http://localhost:3001/health"
else
    echo -e "${YELLOW}  Some services are not healthy. Check the logs:${NC}"
    echo -e "   docker-compose logs -f"
fi

echo ""
echo -e "${BLUE} Container Status:${NC}"
docker-compose ps
