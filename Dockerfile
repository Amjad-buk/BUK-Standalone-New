FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run check && npm run audit && npm run build
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm", "start"]
