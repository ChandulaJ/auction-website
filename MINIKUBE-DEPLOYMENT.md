# Minikube Deployment Guide

## Prerequisites

1. **Install Minikube and kubectl**:
   ```bash
   # Install Minikube (if not already installed)
   brew install minikube
   
   # Install kubectl (if not already installed)
   brew install kubectl
   ```

2. **Start Minikube with sufficient resources**:
   ```bash
   minikube start --cpus=4 --memory=8192 --driver=docker
   ```

3. **Enable required addons**:
   ```bash
   minikube addons enable ingress
   minikube addons enable dashboard
   minikube addons enable metrics-server
   ```

## Quick Deployment

1. **Deploy everything**:
   ```bash
   ./deploy-minikube.sh
   ```

2. **Access the application**:
   - Frontend: http://auction.local
   - API: http://api.auction.local

## Manual Deployment Steps

If you prefer to deploy manually or need to troubleshoot:

### 1. Build Images
```bash
# Set Docker environment to Minikube
eval $(minikube docker-env)

# Build all images
docker build -t auction-common:latest ./common
docker build -t auction-auth:latest ./services/auth
docker build -t auction-bid:latest ./services/bid
docker build -t auction-listings:latest ./services/listings
docker build -t auction-payments:latest ./services/payments
docker build -t auction-profile:latest ./services/profile
docker build -t auction-email:latest ./services/email
docker build -t auction-expiration:latest ./services/expiration
docker build -t auction-api-gateway:latest ./services/api-gateway
docker build -t auction-frontend:latest -f ./services/frontend/Dockerfile.dev ./services/frontend
```

### 2. Deploy Infrastructure
```bash
# Create namespace and secrets
kubectl apply -f k8s/infrastructure/namespace.yaml
kubectl apply -f k8s/infrastructure/secrets.yaml

# Deploy infrastructure services
kubectl apply -f k8s/infrastructure/nats.yaml
kubectl apply -f k8s/infrastructure/redis.yaml
kubectl apply -f k8s/infrastructure/auth-mysql.yaml
kubectl apply -f k8s/infrastructure/bid-mysql.yaml
kubectl apply -f k8s/infrastructure/listings-mysql.yaml
kubectl apply -f k8s/infrastructure/payments-mysql.yaml
kubectl apply -f k8s/infrastructure/profile-mysql.yaml

# Wait for infrastructure to be ready
kubectl wait --for=condition=ready pod -l tier=infrastructure -n auction-system --timeout=300s
```

### 3. Deploy Application Services
```bash
# Deploy application configuration and services
kubectl apply -f k8s/configmaps/app-config.yaml
kubectl apply -f k8s/services/auth.yaml
kubectl apply -f k8s/services/profile.yaml
kubectl apply -f k8s/services/listings.yaml
kubectl apply -f k8s/services/bid.yaml
kubectl apply -f k8s/services/payments.yaml
kubectl apply -f k8s/services/email.yaml
kubectl apply -f k8s/services/expiration.yaml

# Wait for backend services
kubectl wait --for=condition=ready pod -l tier=application -n auction-system --timeout=300s

# Deploy API Gateway and Frontend
kubectl apply -f k8s/services/api-gateway.yaml
kubectl apply -f k8s/services/frontend.yaml

# Deploy ingress
kubectl apply -f k8s/ingress/ingress.yaml
```

## Monitoring and Troubleshooting

### Check Status
```bash
# Check all pods
kubectl get pods -n auction-system

# Check services
kubectl get services -n auction-system

# Check ingress
kubectl get ingress -n auction-system
```

### View Logs
```bash
# View logs for specific service
kubectl logs -f deployment/auth-depl -n auction-system
kubectl logs -f deployment/api-gateway-depl -n auction-system
kubectl logs -f deployment/frontend-depl -n auction-system

# View logs for infrastructure
kubectl logs -f deployment/auth-mysql-depl -n auction-system
kubectl logs -f deployment/nats-streaming-depl -n auction-system
```

### Debug Services
```bash
# Describe pod for detailed information
kubectl describe pod <pod-name> -n auction-system

# Get into a running container
kubectl exec -it <pod-name> -n auction-system -- /bin/sh

# Port forward for direct access
kubectl port-forward svc/frontend-srv 3000:3000 -n auction-system
kubectl port-forward svc/api-gateway-srv 3001:3001 -n auction-system
```

### Common Issues and Solutions

1. **Images not found**:
   - Ensure you've run `eval $(minikube docker-env)` before building images
   - Verify images exist: `docker images | grep auction`

2. **Services not starting**:
   - Check resource limits and available cluster resources: `kubectl top nodes`
   - Check if dependencies are ready: `kubectl get pods -n auction-system`

3. **Database connection issues**:
   - Ensure MySQL services are ready: `kubectl get pods -l tier=infrastructure -n auction-system`
   - Check database logs: `kubectl logs -f deployment/auth-mysql-depl -n auction-system`

4. **Ingress not working**:
   - Ensure ingress addon is enabled: `minikube addons list | grep ingress`
   - Check ingress controller: `kubectl get pods -n ingress-nginx`
   - Verify /etc/hosts entries: `cat /etc/hosts | grep auction`

### Performance Optimization

1. **Scale services based on load**:
   ```bash
   kubectl scale deployment/auth-depl --replicas=2 -n auction-system
   kubectl scale deployment/listings-depl --replicas=2 -n auction-system
   ```

2. **Monitor resource usage**:
   ```bash
   kubectl top pods -n auction-system
   kubectl top nodes
   ```

## Cleanup

To remove everything:
```bash
./cleanup-minikube.sh
```

Or manually:
```bash
kubectl delete namespace auction-system
```

## Development Workflow

1. **Make code changes**
2. **Rebuild specific service**:
   ```bash
   eval $(minikube docker-env)
   docker build -t auction-auth:latest ./services/auth
   ```
3. **Restart deployment**:
   ```bash
   kubectl rollout restart deployment/auth-depl -n auction-system
   ```
4. **Monitor logs**:
   ```bash
   kubectl logs -f deployment/auth-depl -n auction-system
   ```

## Accessing Minikube Dashboard

```bash
minikube dashboard
```

This will open the Kubernetes dashboard in your browser for visual monitoring and management.
