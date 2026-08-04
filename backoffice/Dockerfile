# Stage 1: Build the React/Vite application
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build Vite app
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:alpine

# Hapus default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy hasil build dari Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration (jika ada) untuk menangani React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
