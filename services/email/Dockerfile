FROM node:18-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 3106

# Start the application
CMD ["npm", "start"]
