FROM node:16-alpine
ENV CI=true

WORKDIR /app

# Copy and build the common package first
COPY ../../common ./common
WORKDIR /app/common
RUN npm install && npm run build

# Now work on the frontend
WORKDIR /app/frontend
COPY package*.json ./
RUN npm cache clean --force && npm install

# Copy frontend source
COPY . .

# Build the frontend
RUN npm run build

CMD ["npm", "run", "start"]