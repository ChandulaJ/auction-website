#!/bin/bash

# Minikube Auction Website Cleanup Script
# This script removes all auction website resources from Minikube

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Cleaning up Auction Website from Minikube${NC}"

# Delete all resources in the auction-system namespace
if kubectl get namespace auction-system > /dev/null 2>&1; then
    echo "Deleting all resources in auction-system namespace..."
    
    # Delete services first
    kubectl delete -f k8s/services/ --ignore-not-found=true
    kubectl delete -f k8s/ingress/ --ignore-not-found=true
    kubectl delete -f k8s/configmaps/ --ignore-not-found=true
    
    # Delete infrastructure
    kubectl delete -f k8s/infrastructure/ --ignore-not-found=true
    
    # Delete namespace (this will delete any remaining resources)
    kubectl delete namespace auction-system --ignore-not-found=true
    
    echo -e "${GREEN}✅ All Kubernetes resources deleted${NC}"
else
    echo -e "${YELLOW}⚠️  auction-system namespace not found${NC}"
fi

# Clean up Docker images (optional)
read -p "Do you want to clean up Docker images? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning up Docker images..."
    
    # Set docker environment to use Minikube's docker daemon
    eval $(minikube docker-env)
    
    # Remove auction images
    docker images | grep "auction-" | awk '{print $1":"$2}' | xargs -r docker rmi --force
    
    echo -e "${GREEN}✅ Docker images cleaned up${NC}"
fi

# Remove /etc/hosts entries (optional)
read -p "Do you want to remove /etc/hosts entries? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing /etc/hosts entries (requires sudo)..."
    sudo sed -i '' '/auction.local/d' /etc/hosts
    sudo sed -i '' '/api.auction.local/d' /etc/hosts
    echo -e "${GREEN}✅ /etc/hosts entries removed${NC}"
fi

echo -e "${GREEN}🎉 Cleanup completed!${NC}"
