#!/bin/bash

# Auction Website Docker Stack Validation Script
# This script validates that all services are running and healthy

echo "🎯 Auction Website Docker Stack Validation"
echo "=========================================="
echo

# Function to check if a URL is accessible
check_url() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}
    
    echo -n "Checking $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "$expected_code" ]; then
        echo "✅ OK ($response)"
        return 0
    else
        echo "❌ FAILED ($response)"
        return 1
    fi
}

# Function to check Docker container status
check_container() {
    local container=$1
    local name=$2
    
    echo -n "Checking $name container... "
    status=$(docker ps --filter "name=$container" --format "{{.Status}}" 2>/dev/null)
    
    if [[ $status == *"Up"* ]]; then
        echo "✅ Running ($status)"
        return 0
    else
        echo "❌ Not Running ($status)"
        return 1
    fi
}

echo "📦 Container Status Check"
echo "------------------------"
check_container "auction-nats" "NATS Streaming"
check_container "auction-redis" "Redis"
check_container "auction-auth-mysql" "Auth MySQL"
check_container "auction-bid-mysql" "Bid MySQL"
check_container "auction-listings-mysql" "Listings MySQL"
check_container "auction-payments-mysql" "Payments MySQL"
check_container "auction-profile-mysql" "Profile MySQL"
check_container "auction-auth" "Auth Service"
check_container "auction-bid" "Bid Service"
check_container "auction-listings" "Listings Service"
check_container "auction-payments" "Payments Service"
check_container "auction-profile" "Profile Service"
check_container "auction-email" "Email Service"
check_container "auction-expiration" "Expiration Service"
check_container "auction-api-gateway" "API Gateway"
check_container "auction-frontend" "Frontend"
echo

echo "🌐 Service Endpoint Check"
echo "-------------------------"
check_url "http://localhost:3001/health" "API Gateway Health"
check_url "http://localhost:3001/api" "API Gateway Info"
check_url "http://localhost:3001/api/auth/current-user" "Auth Service" 200
check_url "http://localhost:3000" "Frontend" 200
echo

echo "🔍 Service Logs Check"
echo "---------------------"
echo "Checking for recent errors in service logs..."

# Check for errors in logs
services=("auction-auth" "auction-bid" "auction-listings" "auction-payments" "auction-profile" "auction-api-gateway")
for service in "${services[@]}"; do
    echo -n "Checking $service logs... "
    errors=$(docker logs "$service" --tail 50 2>&1 | grep -i "error\|failed\|exception" | wc -l)
    if [ "$errors" -eq 0 ]; then
        echo "✅ No recent errors"
    else
        echo "⚠️  Found $errors error(s)"
    fi
done
echo

echo "📊 Summary"
echo "----------"
total_containers=$(docker ps --filter "name=auction-" --format "{{.Names}}" | wc -l)
healthy_containers=$(docker ps --filter "name=auction-" --filter "status=running" --format "{{.Names}}" | wc -l)

echo "Total containers: $total_containers"
echo "Running containers: $healthy_containers"

if [ "$total_containers" -eq "$healthy_containers" ] && [ "$healthy_containers" -gt 0 ]; then
    echo
    echo "🎉 SUCCESS: All services are running!"
    echo
    echo "📍 Access Points:"
    echo "   Frontend:    http://localhost:3000"
    echo "   API Gateway: http://localhost:3001"
    echo "   Auth API:    http://localhost:3001/api/auth"
    echo "   Bids API:    http://localhost:3001/api/bids"
    echo "   Listings API: http://localhost:3001/api/listings"
    echo "   Payments API: http://localhost:3001/api/payments"
    echo "   Profile API:  http://localhost:3001/api/profile"
    echo
    echo "🛠️  Management:"
    echo "   NATS Monitor: http://localhost:8222"
    echo "   Redis:        localhost:6379"
    echo "   MySQL Auth:   localhost:3306"
    echo "   MySQL Bid:    localhost:3307"
    echo "   MySQL Listings: localhost:3308"
    echo "   MySQL Payments: localhost:3309"
    echo "   MySQL Profile:  localhost:3310"
    echo
    exit 0
else
    echo
    echo "❌ FAILURE: Some services are not running properly"
    echo "Run 'docker-compose logs' to check for issues"
    echo
    exit 1
fi
