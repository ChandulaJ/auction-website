FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY api-gateway.js ./
COPY .env ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeapp -u 1001

# Change ownership of the app directory
RUN chown -R nodeapp:nodejs /app

# Switch to non-root user
USER nodeapp

EXPOSE 8080

CMD ["node", "api-gateway.js"]
