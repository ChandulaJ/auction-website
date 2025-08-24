FROM node:18-alpine
ENV CI=true
WORKDIR /app

# Copy the package.json and package-lock.json for better dependency resolution
COPY package.json package-lock.json ./

# Install only production dependencies
RUN rm -rf node_modules package-lock.json && \
    npm install --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy the built application from local build
COPY .next ./.next
COPY public ./public

CMD ["npm", "run", "start"]
