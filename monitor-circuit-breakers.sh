#!/bin/bash

# Circuit Breaker Health Monitoring Script
# Monitors all circuit breakers across the auction website microservices

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
# API_GATEWAY_URL="http://localhost:3001"
# AUTH_SERVICE_URL="http://localhost:300"
# BID_SERVICE_URL="http://localhost:3003"
# LISTINGS_SERVICE_URL="http://localhost:3002"
# PAYMENTS_SERVICE_URL="http://localhost:3004"
# PROFILE_SERVICE_URL="http://localhost:3005"
# EMAIL_SERVICE_URL="http://localhost:3007"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "healthy")
            echo -e "${GREEN}✅ ${message}${NC}"
            ;;
        "unhealthy"|"degraded")
            echo -e "${RED}❌ ${message}${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  ${message}${NC}"
            ;;
        "info")
            echo -e "${BLUE}ℹ️  ${message}${NC}"
            ;;
        *)
            echo -e "${NC}${message}${NC}"
            ;;
    esac
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local service_url=$2
    local health_endpoint="${service_url}/health"
    
    echo ""
    print_status "info" "Checking ${service_name} service..."
    
    if response=$(curl -s -w "%{http_code}" --max-time 10 "$health_endpoint" 2>/dev/null); then
        http_code="${response: -3}"
        response_body="${response%???}"
        
        if [ "$http_code" -eq 200 ]; then
            print_status "healthy" "${service_name} is healthy"
            
            # Parse and display circuit breaker information if available
            if echo "$response_body" | jq -e '.circuitBreakers' > /dev/null 2>&1; then
                echo "  Circuit Breakers:"
                echo "$response_body" | jq -r '.circuitBreakers[] | "    \(.service): \(.state) (Failures: \(.failureCount), Error Rate: \(.errorRate | floor)%)"'
            elif echo "$response_body" | jq -e '.stripe.circuitBreaker' > /dev/null 2>&1; then
                echo "  Stripe Circuit Breaker:"
                echo "$response_body" | jq -r '.stripe.circuitBreaker | "    \(.name): \(.state) (Failures: \(.failureCount), Error Rate: \(.errorRate | floor)%)"'
            elif echo "$response_body" | jq -e '.smtp.circuitBreaker' > /dev/null 2>&1; then
                echo "  SMTP Circuit Breaker:"
                echo "$response_body" | jq -r '.smtp.circuitBreaker | "    \(.name): \(.state) (Failures: \(.failureCount), Error Rate: \(.errorRate | floor)%)"'
            elif echo "$response_body" | jq -e '.dependencies' > /dev/null 2>&1; then
                echo "  Dependencies:"
                echo "$response_body" | jq -r '.dependencies | to_entries[] | "    \(.key): \(.value.circuitBreaker.state) (Failures: \(.value.circuitBreaker.failureCount))"'
            fi
        elif [ "$http_code" -eq 503 ]; then
            print_status "unhealthy" "${service_name} is unhealthy (503)"
            echo "  Response: $(echo "$response_body" | jq -r '.message // "Service degraded"')"
        else
            print_status "warning" "${service_name} returned HTTP ${http_code}"
        fi
    else
        print_status "unhealthy" "${service_name} is unreachable"
    fi
}

# Function to check API Gateway circuit breakers specifically
check_api_gateway_circuit_breakers() {
    echo ""
    print_status "info" "Checking API Gateway Circuit Breakers..."
    
    if response=$(curl -s --max-time 10 "${API_GATEWAY_URL}/circuit-breakers" 2>/dev/null); then
        if echo "$response" | jq -e '.[0]' > /dev/null 2>&1; then
            echo "  Circuit Breaker Details:"
            echo "$response" | jq -r '.[] | "    \(.service): \(.state) - Requests: \(.totalRequests), Failures: \(.totalFailures), Error Rate: \(.errorRate | floor)%"'
            
            # Check for any OPEN circuit breakers
            open_breakers=$(echo "$response" | jq -r '.[] | select(.state == "OPEN") | .service')
            if [ -n "$open_breakers" ]; then
                echo ""
                print_status "warning" "OPEN Circuit Breakers detected:"
                echo "$open_breakers" | while read breaker; do
                    echo "    - $breaker"
                done
            fi
        else
            print_status "warning" "No circuit breaker data available"
        fi
    else
        print_status "unhealthy" "Could not fetch circuit breaker status from API Gateway"
    fi
}

# Function to trip a circuit breaker (for testing)
trip_circuit_breaker() {
    local service_name=$1
    
    if [ -z "$service_name" ]; then
        echo "Usage: $0 trip <service_name>"
        echo "Available services: auth, bid, listings, payments, profile"
        exit 1
    fi
    
    print_status "warning" "Tripping circuit breaker for ${service_name}..."
    
    if response=$(curl -s -X POST "${API_GATEWAY_URL}/circuit-breakers/${service_name}/trip" 2>/dev/null); then
        message=$(echo "$response" | jq -r '.message // "Circuit breaker tripped"')
        print_status "warning" "$message"
    else
        print_status "unhealthy" "Failed to trip circuit breaker for ${service_name}"
    fi
}

# Function to reset a circuit breaker
reset_circuit_breaker() {
    local service_name=$1
    
    if [ -z "$service_name" ]; then
        echo "Usage: $0 reset <service_name>"
        echo "Available services: auth, bid, listings, payments, profile"
        exit 1
    fi
    
    print_status "info" "Resetting circuit breaker for ${service_name}..."
    
    if response=$(curl -s -X POST "${API_GATEWAY_URL}/circuit-breakers/${service_name}/reset" 2>/dev/null); then
        message=$(echo "$response" | jq -r '.message // "Circuit breaker reset"')
        print_status "healthy" "$message"
    else
        print_status "unhealthy" "Failed to reset circuit breaker for ${service_name}"
    fi
}

# Function to display usage
show_usage() {
    echo "Circuit Breaker Monitoring Tool"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  check        Check all services and circuit breakers (default)"
    echo "  trip <svc>   Trip a circuit breaker for testing"
    echo "  reset <svc>  Reset a circuit breaker"
    echo "  watch        Continuously monitor circuit breakers"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Check all services"
    echo "  $0 check                # Check all services"
    echo "  $0 trip payments        # Trip payments circuit breaker"
    echo "  $0 reset payments       # Reset payments circuit breaker"
    echo "  $0 watch                # Watch circuit breakers continuously"
}

# Function to watch circuit breakers continuously
watch_circuit_breakers() {
    print_status "info" "Starting continuous monitoring (Press Ctrl+C to stop)..."
    
    while true; do
        clear
        echo "=== Circuit Breaker Health Monitor ==="
        echo "Last updated: $(date)"
        
        check_service_health "API Gateway" "$API_GATEWAY_URL"
        check_api_gateway_circuit_breakers
        check_service_health "Auth" "$AUTH_SERVICE_URL"
        check_service_health "Bid" "$BID_SERVICE_URL"
        check_service_health "Listings" "$LISTINGS_SERVICE_URL"
        check_service_health "Payments" "$PAYMENTS_SERVICE_URL"
        check_service_health "Profile" "$PROFILE_SERVICE_URL"
        check_service_health "Email" "$EMAIL_SERVICE_URL"
        
        echo ""
        print_status "info" "Refreshing in 30 seconds... (Press Ctrl+C to stop)"
        sleep 30
    done
}

# Main script logic
main() {
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_status "unhealthy" "jq is required but not installed. Please install jq to run this script."
        exit 1
    fi
    
    case ${1:-check} in
        "check")
            echo "=== Circuit Breaker Health Monitor ==="
            echo "Timestamp: $(date)"
            
            check_service_health "API Gateway" "$API_GATEWAY_URL"
            check_api_gateway_circuit_breakers
            check_service_health "Auth" "$AUTH_SERVICE_URL"
            check_service_health "Bid" "$BID_SERVICE_URL"
            check_service_health "Listings" "$LISTINGS_SERVICE_URL"
            check_service_health "Payments" "$PAYMENTS_SERVICE_URL"
            check_service_health "Profile" "$PROFILE_SERVICE_URL"
            check_service_health "Email" "$EMAIL_SERVICE_URL"
            
            echo ""
            print_status "info" "Health check completed"
            ;;
        "trip")
            trip_circuit_breaker "$2"
            ;;
        "reset")
            reset_circuit_breaker "$2"
            ;;
        "watch")
            watch_circuit_breakers
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            echo "Unknown command: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
