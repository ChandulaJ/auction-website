#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Frontend Service${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Load environment variables
if [ -f ".env" ]; then
    echo -e "${YELLOW}🔧 Loading environment variables from .env${NC}"
    source .env
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠️  No .env file found. Using default configuration.${NC}"
fi

echo -e "${GREEN}✅ Starting Frontend Service on port ${PORT:-3000}...${NC}"
echo -e "${BLUE}🌐 Application URL: http://localhost:${PORT:-3000}${NC}"
echo -e "${YELLOW}🔗 API Gateway: ${NEXT_PUBLIC_API_URL}${NC}"

# Start the development server
npm run dev
