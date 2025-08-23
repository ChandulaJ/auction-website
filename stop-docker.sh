#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE} Stopping Auction Website Docker Services${NC}"

# Stop all services
echo -e "${YELLOW} Stopping all containers...${NC}"
docker-compose down

# Optional: Remove volumes (uncomment if you want to clear all data)
if [ "$1" = "--clean" ] || [ "$1" = "-c" ]; then
    echo -e "${YELLOW} Removing volumes and cleaning up...${NC}"
    docker-compose down -v
    docker system prune -f --volumes
    echo -e "${GREEN} Complete cleanup finished${NC}"
else
    echo -e "${YELLOW}💡 To remove all data and volumes, run: ./stop-docker.sh --clean${NC}"
fi

echo -e "${GREEN} All services stopped successfully!${NC}"
echo -e "${BLUE} Remaining containers:${NC}"
docker ps -a --filter "name=auction"

echo -e ""
echo -e "${GREEN} To start again, run: ./start-docker.sh${NC}"
