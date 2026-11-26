FROM node:20-alpine AS builder

WORKDIR /app

COPY vidyamedic-web/package.json vidyamedic-web/package-lock.json ./
RUN npm ci

COPY vidyamedic-web/ ./
COPY shared/caparGraph.mjs /shared/caparGraph.mjs
RUN npm run build

FROM nginx:1.27-alpine

COPY vidyamedic-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
