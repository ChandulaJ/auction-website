#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verifying Microservice Environment Setup${NC}"
echo "=================================================="

# Check if each service has its environment files
services=("api-gateway" "auth" "bid" "listings" "payments" "profile" "email" "expiration" "frontend")

for service in "${services[@]}"; do
    echo -e "\n${YELLOW}📁 Checking $service service...${NC}"
    
    service_dir="services/$service"
    
    # Check if service directory exists
    if [ ! -d "$service_dir" ]; then
        echo -e "${RED}❌ Service directory not found: $service_dir${NC}"
        continue
    fi
    
    # Check for .env file
    if [ -f "$service_dir/.env" ]; then
        echo -e "${GREEN}✅ .env file found${NC}"
        # Show port configuration
        if grep -q "PORT=" "$service_dir/.env"; then
            port=$(grep "PORT=" "$service_dir/.env" | cut -d'=' -f2)
            echo -e "   📡 Configured port: $port"
        fi
    else
        echo -e "${RED}❌ .env file missing${NC}"
    fi
    
    # Check for .gitignore file
    if [ -f "$service_dir/.gitignore" ]; then
        echo -e "${GREEN}✅ .gitignore file found${NC}"
    else
        echo -e "${RED}❌ .gitignore file missing${NC}"
    fi
    
    # Check for startup script
    if [ -f "$service_dir/start-service.sh" ]; then
        echo -e "${GREEN}✅ start-service.sh found${NC}"
        if [ -x "$service_dir/start-service.sh" ]; then
            echo -e "   🔧 Script is executable"
        else
            echo -e "${YELLOW}   ⚠️  Script needs execute permission${NC}"
        fi
    else
        echo -e "${RED}❌ start-service.sh missing${NC}"
    fi
    
    # Check for package.json
    if [ -f "$service_dir/package.json" ]; then
        echo -e "${GREEN}✅ package.json found${NC}"
    else
        echo -e "${RED}❌ package.json missing${NC}"
    fi
done

echo -e "\n${BLUE}🛠️  Infrastructure Check${NC}"
echo "========================="

# Check if docker-compose file exists
if [ -f "docker-compose.infrastructure.yml" ]; then
    echo -e "${GREEN}✅ Infrastructure docker-compose file found${NC}"
else
    echo -e "${RED}❌ Infrastructure docker-compose file missing${NC}"
fi

# Check if main startup script exists
if [ -f "start-local-hybrid.sh" ]; then
    echo -e "${GREEN}✅ Main startup script found${NC}"
    if [ -x "start-local-hybrid.sh" ]; then
        echo -e "   🔧 Script is executable"
    else
        echo -e "${YELLOW}   ⚠️  Script needs execute permission${NC}"
    fi
else
    echo -e "${RED}❌ Main startup script missing${NC}"
fi

echo -e "\n${GREEN}🎉 Environment verification complete!${NC}"
echo -e "${BLUE}💡 To start the full application: ./start-local-hybrid.sh${NC}"
echo -e "${BLUE}📖 For independent deployment guide: see MICROSERVICE-DEPLOYMENT.md${NC}"
