#!/bin/bash
# Load environment variables from .env.local
set -a
source ../../.env.local
set +a

# Start the listings service
npm start
