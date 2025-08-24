#!/bin/bash

# Minikube Auction Website Deployment Script
# This script deploys the auction website microservices to Minikube

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Minikube Auction Website Deployment${NC}"

# Check if Minikube is running
if ! minikube status > /dev/null 2>&1; then
    echo -e "${RED}❌ Minikube is not running. Please start Minikube first:${NC}"
    echo "minikube start --cpus=4 --memory=8192 --driver=docker"
    exit 1
fi

# Check if ingress addon is enabled
if ! minikube addons list | grep "ingress" | grep "enabled" > /dev/null; then
    echo -e "${YELLOW}📦 Enabling ingress addon...${NC}"
    minikube addons enable ingress
fi

# Set docker environment to use Minikube's docker daemon
echo -e "${YELLOW}🐳 Setting Docker environment to Minikube...${NC}"
eval $(minikube docker-env)

# Build Docker images
echo -e "${YELLOW}🔨 Building Docker images...${NC}"

# Build common package first
echo "Building common package..."
docker build -t auction-common:latest ./common

# Build all microservices
echo "Building auth service..."
docker build -t auction-auth:latest ./services/auth

echo "Building bid service..."
docker build -t auction-bid:latest ./services/bid

echo "Building listings service..."
docker build -t auction-listings:latest ./services/listings

echo "Building payments service..."
docker build -t auction-payments:latest ./services/payments

echo "Building profile service..."
docker build -t auction-profile:latest ./services/profile

echo "Building email service..."
docker build -t auction-email:latest ./services/email

echo "Building expiration service..."
docker build -t auction-expiration:latest ./services/expiration

echo "Building api-gateway..."
docker build -t auction-api-gateway:latest ./services/api-gateway

echo "Building frontend..."
docker build -t auction-frontend:latest -f ./services/frontend/Dockerfile.dev ./services/frontend

echo -e "${GREEN}✅ All images built successfully${NC}"

# Deploy to Kubernetes
echo -e "${YELLOW}☸️  Deploying to Kubernetes...${NC}"

# Create namespace and secrets
echo "Creating namespace and secrets..."
kubectl apply -f k8s/infrastructure/namespace.yaml
kubectl apply -f k8s/infrastructure/secrets.yaml

# Deploy infrastructure services
echo "Deploying infrastructure services..."
kubectl apply -f k8s/infrastructure/nats.yaml
kubectl apply -f k8s/infrastructure/redis.yaml

# Deploy MySQL databases
echo "Deploying MySQL databases..."
kubectl apply -f k8s/infrastructure/auth-mysql.yaml
kubectl apply -f k8s/infrastructure/bid-mysql.yaml
kubectl apply -f k8s/infrastructure/listings-mysql.yaml
kubectl apply -f k8s/infrastructure/payments-mysql.yaml
kubectl apply -f k8s/infrastructure/profile-mysql.yaml

# Wait for infrastructure to be ready
echo -e "${YELLOW}⏳ Waiting for infrastructure services to be ready...${NC}"
kubectl wait --for=condition=ready pod -l tier=infrastructure -n auction-system --timeout=300s

# Deploy application services
echo "Deploying application services..."
kubectl apply -f k8s/configmaps/app-config.yaml
kubectl apply -f k8s/services/auth.yaml
kubectl apply -f k8s/services/profile.yaml
kubectl apply -f k8s/services/listings.yaml
kubectl apply -f k8s/services/bid.yaml
kubectl apply -f k8s/services/payments.yaml
kubectl apply -f k8s/services/email.yaml
kubectl apply -f k8s/services/expiration.yaml

# Wait for backend services to be ready
echo -e "${YELLOW}⏳ Waiting for backend services to be ready...${NC}"
sleep 30
kubectl wait --for=condition=ready pod -l tier=application -n auction-system --timeout=300s

# Deploy API Gateway and Frontend
echo "Deploying API Gateway and Frontend..."
kubectl apply -f k8s/services/api-gateway.yaml
sleep 15
kubectl apply -f k8s/services/frontend.yaml

# Deploy ingress
echo "Deploying ingress..."
kubectl apply -f k8s/ingress/ingress.yaml

# Wait for all services to be ready
echo -e "${YELLOW}⏳ Waiting for all services to be ready...${NC}"
kubectl wait --for=condition=ready pod -l tier=frontend -n auction-system --timeout=300s

# Get Minikube IP and update /etc/hosts
MINIKUBE_IP=$(minikube ip)
echo -e "${YELLOW}🌐 Minikube IP: ${MINIKUBE_IP}${NC}"

# Check if entries exist in /etc/hosts and add them if not
if ! grep -q "auction.local" /etc/hosts; then
    echo -e "${YELLOW}📝 Adding entries to /etc/hosts (requires sudo)...${NC}"
    echo "$MINIKUBE_IP auction.local" | sudo tee -a /etc/hosts
    echo "$MINIKUBE_IP api.auction.local" | sudo tee -a /etc/hosts
fi

# Display status
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${GREEN}📊 Service Status:${NC}"
kubectl get pods -n auction-system

echo ""
echo -e "${GREEN}🌐 Access URLs:${NC}"
echo "Frontend: http://auction.local"
echo "API Gateway: http://api.auction.local"
echo ""
echo -e "${GREEN}🔍 Useful commands:${NC}"
echo "kubectl get pods -n auction-system"
echo "kubectl logs -f deployment/frontend-depl -n auction-system"
echo "kubectl logs -f deployment/api-gateway-depl -n auction-system"
echo "minikube dashboard"
echo ""
echo -e "${YELLOW}Note: It may take a few minutes for all services to be fully ready.${NC}"
