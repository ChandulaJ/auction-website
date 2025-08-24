FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install typescript for building
RUN npm install -g typescript

# Copy source code
COPY . .

# Build the common package
RUN npm run build

# Create a volume for the build output
VOLUME ["/app/build"]

# Keep container running (this is a builder container)
CMD ["tail", "-f", "/dev/null"]
