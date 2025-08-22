# Auction Website - Microservices Architecture

## 📁 Project Structure (Optimized for Independent Deployment)

```
auction-website/
├── services/                    # All microservices
│   ├── api-gateway/            # API Gateway Service
│   │   ├── api-gateway.js      # Main gateway logic
│   │   ├── package.json        # Gateway dependencies
│   │   ├── Dockerfile          # Production container
│   │   ├── Dockerfile.dev      # Development container
│   │   └── .env               # Environment variables
│   ├── auth/                   # Authentication Service
│   ├── bid/                    # Bidding Service
│   ├── listings/               # Listings Service
│   ├── payments/               # Payments Service
│   ├── profile/                # Profile Service
│   ├── email/                  # Email Service
│   ├── expiration/             # Expiration Service
│   └── frontend/               # Next.js Frontend
├── infrastructure/             # Deployment & Infrastructure
│   ├── k8s/                   # Kubernetes manifests
│   └── bucket-policy.json     # AWS S3 bucket policy
├── common/                     # Shared libraries
└── logs/                      # Application logs
```
