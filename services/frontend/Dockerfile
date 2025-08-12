FROM node:14.15.5-alpine3.10
ENV CI=true
 
WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm ci
COPY . .
RUN npm run build

CMD ["npm", "run", "start"]