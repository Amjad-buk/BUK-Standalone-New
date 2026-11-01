FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache unzip
COPY BUK-standalone-final.zip /tmp/BUK-standalone-final.zip
RUN unzip -q /tmp/BUK-standalone-final.zip -d /tmp/buk-source && cp -a /tmp/buk-source/BUK-standalone-final/. /app/ && rm -rf /tmp/buk-source /tmp/BUK-standalone-final.zip
COPY scripts/enable-local-qwen.cjs /tmp/enable-local-qwen.cjs
RUN node /tmp/enable-local-qwen.cjs && rm /tmp/enable-local-qwen.cjs
RUN npm install --no-audit --no-fund
RUN npm run check && npm run audit && npm run build
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm", "start"]
